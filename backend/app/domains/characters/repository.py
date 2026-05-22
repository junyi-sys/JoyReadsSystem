from sqlalchemy.orm import Session
from ...models import TargetCharacter, ScoutCharacter, AllyCharacter, LostCharacter, DailyCharacter


class CharacterRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_zone_counts(self, student_id: int) -> dict:
        return {
            "target": self.db.query(TargetCharacter).filter(TargetCharacter.student_id == student_id).count(),
            "scout": self.db.query(ScoutCharacter).filter(ScoutCharacter.student_id == student_id).count(),
            "ally": self.db.query(AllyCharacter).filter(AllyCharacter.student_id == student_id).count(),
            "lost": self.db.query(LostCharacter).filter(LostCharacter.student_id == student_id).count(),
        }

    def get_zone_chars(self, zone: str, student_id: int) -> list:
        model_map = {
            "target": TargetCharacter, "scout": ScoutCharacter,
            "ally": AllyCharacter, "lost": LostCharacter,
        }
        model = model_map.get(zone)
        if not model:
            return []
        records = self.db.query(model).filter(model.student_id == student_id).all()
        result = []
        for r in records:
            result.append({
                "id": r.id, "character": r.character,
            })
        return result

    def add_character(self, zone: str, student_id: int, character: str):
        from datetime import date
        model_map = {
            "target": TargetCharacter, "scout": ScoutCharacter,
            "ally": AllyCharacter, "lost": LostCharacter,
        }
        model = model_map.get(zone)
        if not model:
            raise ValueError(f"Invalid zone: {zone}")
        record = model(student_id=student_id, character=character, added_date=date.today())
        self.db.add(record)
        self.db.commit()

    def move_character(self, character: str, from_zone: str, to_zone: str, student_id: int):
        from datetime import date
        model_map = {
            "target": TargetCharacter, "scout": ScoutCharacter,
            "ally": AllyCharacter, "lost": LostCharacter,
        }
        from_model = model_map.get(from_zone)
        to_model = model_map.get(to_zone)
        if not from_model or not to_model:
            raise ValueError("Invalid zone")

        record = self.db.query(from_model).filter(
            from_model.student_id == student_id,
            from_model.character == character,
        ).first()
        if not record:
            raise ValueError(f"Character '{character}' not found in {from_zone}")

        self.db.delete(record)

        new_record = to_model(
            student_id=student_id, character=character,
            added_date=date.today(),
        )
        self.db.add(new_record)
        self.db.commit()
