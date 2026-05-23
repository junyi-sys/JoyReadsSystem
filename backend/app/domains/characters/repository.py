from datetime import date, datetime
from sqlalchemy.orm import Session
from ...models import Character, CharacterInteraction, CharacterZoneLog, DailyCharacter
from ...shared.ensure_student import ensure_student


class CharacterRepository:
    def __init__(self, db: Session):
        self.db = db

    # ===== Zone queries =====

    def get_zone_counts(self, student_id: int) -> dict:
        counts = {"target": 0, "scout": 0, "ally": 0, "lost": 0}
        rows = (
            self.db.query(Character.zone, Character.id)
            .filter(Character.student_id == student_id)
            .all()
        )
        for zone, _ in rows:
            if zone and zone.value in counts:
                counts[zone.value] += 1
        return counts

    def get_zone_chars(self, zone: str, student_id: int) -> list:
        records = (
            self.db.query(Character)
            .filter(Character.student_id == student_id, Character.zone == zone)
            .order_by(Character.updated_at.desc())
            .all()
        )
        return [
            {"id": r.id, "character": r.character, "tap_count": r.tap_count,
             "appeared_in_articles": r.appeared_in_articles, "source": r.source}
            for r in records
        ]

    # ===== CRUD =====

    def add_character(self, zone: str, student_id: int, character: str):
        sid = ensure_student(self.db, student_id)
        existing = (
            self.db.query(Character)
            .filter(Character.student_id == sid, Character.character == character)
            .first()
        )
        if existing:
            # Move to new zone if different
            if existing.zone.value != zone:
                self.move_character(character, existing.zone.value, zone, sid)
            return existing

        record = Character(
            student_id=sid, character=character, zone=zone,
            source="manual", first_seen_at=date.today(),
        )
        self.db.add(record)
        self.db.flush()
        # Log
        self.db.add(CharacterZoneLog(
            student_id=sid, character=character,
            from_zone="", to_zone=zone, reason="manual",
        ))
        self.db.commit()
        return record

    def move_character(self, character: str, from_zone: str, to_zone: str, student_id: int):
        record = (
            self.db.query(Character)
            .filter(
                Character.student_id == student_id,
                Character.character == character,
                Character.zone == from_zone,
            )
            .first()
        )
        if not record:
            raise ValueError(f"Character '{character}' not found in {from_zone}")

        record.zone = to_zone
        record.zone_changed_at = datetime.now()
        self.db.add(CharacterZoneLog(
            student_id=student_id, character=character,
            from_zone=from_zone, to_zone=to_zone, reason="manual",
        ))
        self.db.commit()

    # ===== Interactions =====

    def record_interaction(self, character: str, student_id: int, article_id: int | None = None):
        """Record a tap-to-speak event and update character stats."""
        from datetime import datetime as dt
        self.db.add(CharacterInteraction(
            student_id=student_id, character=character, article_id=article_id,
        ))
        char_record = (
            self.db.query(Character)
            .filter(Character.student_id == student_id, Character.character == character)
            .first()
        )
        if char_record:
            char_record.tap_count += 1
            char_record.last_tapped_at = dt.now()
        self.db.commit()

    def get_interaction_counts(self, student_id: int, days: int = 30) -> dict[str, int]:
        """Get tap counts per character in recent days."""
        from datetime import date as date_type, timedelta
        from sqlalchemy import func
        cutoff = date_type.today() - timedelta(days=days)
        rows = (
            self.db.query(
                CharacterInteraction.character,
                func.count(CharacterInteraction.id).label("cnt"),
            )
            .filter(
                CharacterInteraction.student_id == student_id,
                CharacterInteraction.created_at >= cutoff,
            )
            .group_by(CharacterInteraction.character)
            .all()
        )
        return {row.character: row.cnt for row in rows}

    # ===== Article-triggered auto-promotion =====

    def get_characters_in_content(self, content: str) -> list[str]:
        """Extract unique Chinese characters from article content."""
        seen = set()
        result = []
        for ch in content:
            if "一" <= ch <= "鿿" and ch not in seen:
                seen.add(ch)
                result.append(ch)
        return result

    def ensure_in_scout(self, character: str, student_id: int, article_id: int):
        """Add a new character to scout zone if not already in any zone."""
        existing = (
            self.db.query(Character)
            .filter(Character.student_id == student_id, Character.character == character)
            .first()
        )
        if existing:
            return existing

        record = Character(
            student_id=student_id, character=character, zone="scout",
            source="reading", first_seen_at=date.today(),
            appeared_in_articles=1,
        )
        self.db.add(record)
        self.db.add(CharacterZoneLog(
            student_id=student_id, character=character,
            from_zone="", to_zone="scout", reason="auto_mastery",
            article_id=article_id,
        ))
        return record

    def increment_appeared(self, character: str, student_id: int):
        """Increment appeared_in_articles counter."""
        record = (
            self.db.query(Character)
            .filter(Character.student_id == student_id, Character.character == character)
            .first()
        )
        if record:
            record.appeared_in_articles += 1

    def increment_never_tapped(self, character: str, student_id: int):
        """Increment never_tapped_in_articles for scout-zone character."""
        record = (
            self.db.query(Character)
            .filter(
                Character.student_id == student_id,
                Character.character == character,
                Character.zone == "scout",
            )
            .first()
        )
        if record:
            record.never_tapped_in_articles += 1

    def promote_scout_to_ally(self, student_id: int, article_id: int) -> int:
        """Promote scout characters with never_tapped_in_articles >= 3 to ally."""
        candidates = (
            self.db.query(Character)
            .filter(
                Character.student_id == student_id,
                Character.zone == "scout",
                Character.never_tapped_in_articles >= 3,
            )
            .all()
        )
        count = 0
        for c in candidates:
            c.zone = "ally"
            c.zone_changed_at = datetime.now()
            self.db.add(CharacterZoneLog(
                student_id=student_id, character=c.character,
                from_zone="scout", to_zone="ally", reason="auto_mastery",
                article_id=article_id,
            ))
            count += 1
        return count

    def degrade_ally_to_target(self, character: str, student_id: int, article_id: int):
        """Move ally character back to target (tapped despite being 'mastered')."""
        record = (
            self.db.query(Character)
            .filter(
                Character.student_id == student_id,
                Character.character == character,
                Character.zone == "ally",
            )
            .first()
        )
        if not record:
            return
        record.zone = "target"
        record.zone_changed_at = datetime.now()
        self.db.add(CharacterZoneLog(
            student_id=student_id, character=character,
            from_zone="ally", to_zone="target", reason="auto_tap",
            article_id=article_id,
        ))

    def check_tap_degrade(self, character: str, student_id: int, article_id: int):
        """Check if tap_count >= 3 and zone is ally → degrade to target."""
        record = (
            self.db.query(Character)
            .filter(Character.student_id == student_id, Character.character == character)
            .first()
        )
        if not record:
            return
        if record.tap_count >= 3 and record.zone.value == "ally":
            self.degrade_ally_to_target(character, student_id, article_id)

    # ===== Zone context for article generation =====

    def get_zone_context(self, student_id: int) -> dict:
        """Get zone-aware context for article generation prompt."""
        ally = (
            self.db.query(Character.character)
            .filter(Character.student_id == student_id, Character.zone == "ally")
            .order_by(Character.updated_at.desc())
            .limit(30)
            .all()
        )
        target = (
            self.db.query(Character.character)
            .filter(Character.student_id == student_id, Character.zone == "target")
            .order_by(Character.updated_at.desc())
            .limit(10)
            .all()
        )
        lost = (
            self.db.query(Character.character)
            .filter(Character.student_id == student_id, Character.zone == "lost")
            .order_by(Character.tap_count.desc())
            .limit(10)
            .all()
        )
        return {
            "ally_chars": [r[0] for r in ally],
            "target_chars": [r[0] for r in target],
            "lost_chars": [r[0] for r in lost],
            "total_known": (
                self.db.query(Character)
                .filter(Character.student_id == student_id, Character.zone.in_(["ally", "scout"]))
                .count()
            ),
        }
