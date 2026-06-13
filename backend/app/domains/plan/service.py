import asyncio
import json
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

        # --- 种子优先逻辑 ---
        seed_info = self.repo.claim_pending_seed(student_id)
        seed_id = None
        original_guide = day.guide_text or ""

        if seed_info:
            seed_id = seed_info["id"]  # claim_pending_seed 已原子地将状态改为 growing
            topic = seed_info["question_text"]
            topic_category = "curiosity"
            prompt = (
                f'孩子曾经问过一个问题："{topic}"。\n'
                f"请以这个问题为线索，写一篇精读短文，适合小学生阅读。\n"
                f"要求：标题简洁、正文300-500字、分2-3个自然段、"
                f"语气像耐心的朋友在解释，不直接灌输答案。\n"
                f"精读焦点：{day.focus}"
            )
            # 将种子信息存入 guide_text JSON，同时保留导读语供前端展示
            day.guide_text = json.dumps({
                "source": "curiosity_seed",
                "seed_id": seed_id,
                "seed_question": topic,
                "guide": original_guide,
            }, ensure_ascii=False)
        else:
            topic_category = day.topic_category
            prompt = (
                f"请写一篇儿童短文，主题类别：{topic_category}，精读焦点：{day.focus}。"
                f"适合小学生阅读，300-500字，使用简单易懂的汉字。"
            )
        # --- 种子优先逻辑结束 ---

        llm = Container.llm()
        try:
            result = asyncio.run(llm.generate(
                prompt,
                system="你是儿童教育作家，写生动有趣的短文。",
                temperature=0.7, max_tokens=1000,
            ))
        except Exception:
            # LLM 失败，回退种子状态
            if seed_id:
                self.repo.update_seed_status(seed_id, "pending")
            raise

        from ...models import DailyArticle
        article = DailyArticle(
            student_id=student_id,
            record_date=date.today(),
            topic=f"精读·{day.focus}",
            content=result.content,
            character_count=len(result.content),
            source="ai",
            category="daily",
            topic_category=topic_category,
        )
        self.repo.db.add(article)
        self.repo.db.commit()
        self.repo.db.refresh(article)

        day.article_id = article.id
        self.repo.update_day(day)
        return {
            "day_id": day.id,
            "article_id": article.id,
            "guide_text": original_guide,  # 返回纯文本导读语，前端不感知 JSON
            "status": day.status,
        }

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

        # --- 种子状态联动 ---
        if day.guide_text:
            try:
                data = json.loads(day.guide_text)
                if data.get("source") == "curiosity_seed":
                    seed_id = data["seed_id"]
                    self.repo.update_seed_status(
                        seed_id, "converted",
                        converted_article_id=day.article_id,
                    )
            except (json.JSONDecodeError, TypeError):
                pass  # 非 JSON 格式 = 预设主题，无需处理
        # --- 种子状态联动结束 ---

        return {"ok": True, "record_id": record.id}
