import asyncio
from datetime import date, timedelta
from sqlalchemy.orm import Session
from .repository import PlanRepository
from ...di import Container


class PlanService:
    def __init__(self, db: Session):
        self.repo = PlanRepository(db)

    def create_plan(self, student_id: int, name: str | None = None) -> dict:
        start = date.today()
        days_until_sunday = (6 - start.weekday()) % 7
        start = start + timedelta(days=days_until_sunday)
        end = start + timedelta(weeks=4, days=-3)
        plan = self.repo.create_plan(
            student_id,
            name=name or f"精读计划 {start.strftime('%m/%d')}-{end.strftime('%m/%d')}",
            start_date=start, end_date=end, week_count=4,
        )
        return {"id": plan.id, "name": plan.name, "start_date": str(plan.start_date),
                "end_date": str(plan.end_date), "week_count": plan.week_count}

    def get_current_plan(self, student_id: int) -> dict | None:
        plan = self.repo.get_current_plan(student_id)
        if not plan:
            return None
        days = self.repo.get_plan_days(plan.id)
        return {
            "id": plan.id, "name": plan.name, "status": plan.status,
            "start_date": str(plan.start_date), "end_date": str(plan.end_date),
            "current_week": plan.current_week, "week_count": plan.week_count,
            "days": [{
                "id": d.id, "week_number": d.week_number, "day_of_week": d.day_of_week,
                "topic_category": d.topic_category, "focus": d.focus,
                "article_id": d.article_id, "guide_text": d.guide_text, "status": d.status,
            } for d in days],
        }

    def start_day(self, day_id: int, student_id: int) -> dict:
        day = self.repo.get_plan_day(day_id)
        if not day:
            raise ValueError("PlanDay not found")
        day.status = "reading"
        self.repo.update_day(day)

        llm = Container.llm()
        result = asyncio.run(llm.generate(
            f"请写一篇儿童短文，主题类别：{day.topic_category}，精读焦点：{day.focus}。"
            f"适合小学生阅读，300-500字，使用简单易懂的汉字。",
            system="你是儿童教育作家，写生动有趣的短文。",
            temperature=0.7, max_tokens=1000,
        ))
        from ...models import DailyArticle
        article = DailyArticle(
            student_id=student_id,
            record_date=date.today(),
            topic=f"精读·{day.focus}",
            content=result.content,
            character_count=len(result.content),
            source="ai",
            category="daily",
            topic_category=day.topic_category,
        )
        self.repo.db.add(article)
        self.repo.db.commit()
        self.repo.db.refresh(article)

        day.article_id = article.id
        self.repo.update_day(day)
        return {"day_id": day.id, "article_id": article.id, "guide_text": day.guide_text, "status": day.status}

    def complete_day(self, day_id: int, student_id: int, child_answer: str, is_correct: bool,
                     question: str, correct_answer: str) -> dict:
        day = self.repo.get_plan_day(day_id)
        if not day:
            raise ValueError("PlanDay not found")
        day.status = "completed"
        self.repo.update_day(day)

        from ...models import ComprehensionRecord
        record = ComprehensionRecord(
            student_id=student_id, article_id=day.article_id,
            plan_day_id=day.id, focus=day.focus,
            question=question, correct_answer=correct_answer,
            child_answer=child_answer, is_correct=is_correct,
        )
        self.repo.db.add(record)
        self.repo.db.commit()
        self.repo.db.refresh(record)
        return {"ok": True, "record_id": record.id}
