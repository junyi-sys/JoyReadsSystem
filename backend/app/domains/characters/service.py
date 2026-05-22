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
        """Return characters in a zone with pinyin annotation."""
        chars = self.repo.get_zone_chars(zone, student_id)
        for c in chars:
            pinyin_result = annotate_text(c["character"])
            c["pinyin"] = pinyin_result["paragraphs"][0]["tokens"][0]["pinyin"] if pinyin_result["paragraphs"] else ""
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
