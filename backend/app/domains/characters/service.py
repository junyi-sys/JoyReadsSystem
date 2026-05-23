from sqlalchemy.orm import Session
from ...shared.pinyin import annotate_text
from .repository import CharacterRepository


class CharacterService:
    def __init__(self, db: Session):
        self.repo = CharacterRepository(db)

    def get_stats(self, student_id: int) -> dict:
        counts = self.repo.get_zone_counts(student_id)
        total = sum(counts.values())
        return {
            "target": counts["target"],
            "scout": counts["scout"],
            "ally": counts["ally"],
            "lost": counts["lost"],
            "total": total,
        }

    def get_zone(self, zone: str, student_id: int) -> list[dict]:
        chars = self.repo.get_zone_chars(zone, student_id)
        for c in chars:
            pinyin_result = annotate_text(c["character"])
            c["pinyin"] = (
                pinyin_result["paragraphs"][0]["tokens"][0]["pinyin"]
                if pinyin_result["paragraphs"]
                else ""
            )
        return chars

    def add_character(self, zone: str, student_id: int, character: str):
        if len(character) != 1:
            raise ValueError("只能添加单个汉字")
        if not ("一" <= character <= "鿿"):
            raise ValueError("请输入有效汉字")
        self.repo.add_character(zone, student_id, character)

    def move_character(self, character: str, from_zone: str, to_zone: str, student_id: int):
        valid_zones = {"target", "scout", "ally", "lost"}
        if from_zone not in valid_zones or to_zone not in valid_zones:
            raise ValueError("无效的区域")
        if from_zone == to_zone:
            raise ValueError("不能移动到相同区域")
        self.repo.move_character(character, from_zone, to_zone, student_id)

    # ===== Interaction & auto-engines =====

    def record_interaction(self, character: str, student_id: int, article_id: int | None = None):
        """Record a tap event and check auto-degradation rules."""
        self.repo.record_interaction(character, student_id, article_id)
        self.repo.check_tap_degrade(character, student_id, article_id)

    def on_article_read(self, content: str, student_id: int, article_id: int):
        """Auto-promotion engine triggered when article is marked read."""
        chars = self.repo.get_characters_in_content(content)
        self.repo.db.begin_nested()  # savepoint for safe partial rollback
        try:
            # Get tapped characters in this article
            from ...models import CharacterInteraction
            tapped_rows = (
                self.repo.db.query(CharacterInteraction.character)
                .filter(
                    CharacterInteraction.student_id == student_id,
                    CharacterInteraction.article_id == article_id,
                )
                .distinct()
                .all()
            )
            tapped_chars = {r[0] for r in tapped_rows}

            for ch in chars:
                # Ensure char is tracked
                self.repo.ensure_in_scout(ch, student_id, article_id)
                self.repo.increment_appeared(ch, student_id)

                if ch not in tapped_chars:
                    # Not tapped in this article → child may know it
                    self.repo.increment_never_tapped(ch, student_id)
                else:
                    # Tapped → child doesn't know it
                    self.repo.degrade_ally_to_target(ch, student_id, article_id)

            # Batch promote: scout → ally
            promoted = self.repo.promote_scout_to_ally(student_id, article_id)
            self.repo.db.commit()
            return {"promoted_to_ally": promoted, "total_chars": len(chars)}
        except Exception:
            self.repo.db.rollback()
            raise

    def get_zone_context(self, student_id: int) -> dict:
        """Get zone context for article generation."""
        return self.repo.get_zone_context(student_id)
