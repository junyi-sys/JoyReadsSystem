from sqlalchemy.orm import Session
from ...models import ComprehensionRecord


class RadarService:
    def __init__(self, db: Session):
        self.db = db

    def compute_radar(self, student_id: int) -> dict:
        records = self.db.query(ComprehensionRecord).filter(
            ComprehensionRecord.student_id == student_id
        ).order_by(ComprehensionRecord.created_at.desc()).limit(20).all()

        dims = {"plot": [], "character": [], "detail": [], "association": [], "imagination": []}
        focus_map = {
            "情节理解": "plot", "人物动机": "character", "细节发现": "detail",
            "联想生活": "association", "发挥想象": "imagination",
        }

        for r in records:
            key = focus_map.get(r.focus)
            if key:
                dims[key].append(1.0 if r.is_correct else 0.0)

        def avg(lst):
            return round(sum(lst) / len(lst) * 100, 1) if lst else 50.0

        return {
            "plot": avg(dims["plot"]),
            "character": avg(dims["character"]),
            "detail": avg(dims["detail"]),
            "association": avg(dims["association"]),
            "imagination": avg(dims["imagination"]),
        }
