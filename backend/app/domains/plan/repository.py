from datetime import date
from sqlalchemy import update
from sqlalchemy.orm import Session
from ...models import ReadingPlan, PlanDay


WEEKLY_THEMES: list[dict] = [
    {"week": 1, "category": "自然", "topics": ["蜜蜂", "蚂蚁", "彩虹", "大海", "星星"]},
    {"week": 2, "category": "科学", "topics": ["影子", "声音", "磁铁", "水循环", "浮力"]},
    {"week": 3, "category": "历史", "topics": ["四大发明", "丝绸之路", "恐龙", "长城"]},
    {"week": 4, "category": "生活", "topics": ["友谊", "勇气", "诚实", "分享", "坚持"]},
]

FOCUS_NAMES = ["情节理解", "人物动机", "细节发现", "联想生活", "发挥想象"]

GUIDE_TEMPLATES: dict[str, str] = {
    "情节理解": "读完告诉爸爸，故事里发生了什么事？",
    "人物动机": "注意看故事里的人为什么那样做？",
    "细节发现": "今天当小侦探，找找有意思的小细节！",
    "联想生活": "故事里的事，你有没有见过类似的？",
    "发挥想象": "猜猜看，接下来会发生什么？",
}


class PlanRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_plan(self, student_id: int, name: str, start_date: date, end_date: date, week_count: int = 4) -> ReadingPlan:
        plan = ReadingPlan(
            student_id=student_id, name=name,
            start_date=start_date, end_date=end_date,
            week_count=week_count, current_week=1,
        )
        self.db.add(plan)
        self.db.flush()

        for w in range(week_count):
            theme = WEEKLY_THEMES[w % len(WEEKLY_THEMES)]
            for d in range(5):
                plan_day = PlanDay(
                    plan_id=plan.id, week_number=w + 1, day_of_week=d,
                    topic_category=theme["category"], focus=FOCUS_NAMES[d],
                    guide_text=GUIDE_TEMPLATES.get(FOCUS_NAMES[d], "今天来读一篇有趣的文章吧！"),
                )
                self.db.add(plan_day)

        self.db.commit()
        self.db.refresh(plan)
        return plan

    def get_current_plan(self, student_id: int) -> ReadingPlan | None:
        return self.db.query(ReadingPlan).filter(
            ReadingPlan.student_id == student_id, ReadingPlan.status == "active"
        ).order_by(ReadingPlan.created_at.desc()).first()

    def get_plan_days(self, plan_id: int, week_number: int | None = None) -> list[PlanDay]:
        q = self.db.query(PlanDay).filter(PlanDay.plan_id == plan_id)
        if week_number:
            q = q.filter(PlanDay.week_number == week_number)
        return q.order_by(PlanDay.week_number, PlanDay.day_of_week).all()

    def get_plan_day(self, day_id: int) -> PlanDay | None:
        return self.db.query(PlanDay).filter(PlanDay.id == day_id).first()

    def update_day(self, day: PlanDay, **kwargs):
        for k, v in kwargs.items():
            setattr(day, k, v)
        self.db.commit()
        self.db.refresh(day)

    def claim_pending_seed(self, student_id: int) -> dict | None:
        """Atomically claim the oldest pending seed. Returns {id, question_text} or None."""
        from ...models import CuriositySeed

        seed = self.db.query(CuriositySeed).filter(
            CuriositySeed.student_id == student_id,
            CuriositySeed.status == "pending"
        ).order_by(CuriositySeed.created_at.asc()).first()

        if not seed:
            return None

        # 条件更新：WHERE id=? AND status='pending'，防止并发重复取
        result = self.db.execute(
            update(CuriositySeed)
            .where(CuriositySeed.id == seed.id, CuriositySeed.status == "pending")
            .values(status="growing")
        )
        self.db.commit()

        if result.rowcount == 0:
            # 另一个请求已抢先取走，fallback
            return None

        return {"id": seed.id, "question_text": seed.question_text}

    def update_seed_status(self, seed_id: int, status: str,
                           converted_article_id: int | None = None):
        """Update a curiosity seed's status. Delegates to SeedRepository."""
        from ..seeds.repository import SeedRepository
        seed_repo = SeedRepository(self.db)
        seed_repo.update_status(seed_id, status, converted_article_id)
