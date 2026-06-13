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
        import json
        return {
            "id": plan.id, "name": plan.name, "status": plan.status,
            "start_date": str(plan.start_date), "end_date": str(plan.end_date),
            "current_week": plan.current_week, "week_count": plan.week_count,
            "days": [{
                "id": d.id, "week_number": d.week_number, "day_of_week": d.day_of_week,
                "topic_category": d.topic_category, "focus": d.focus,
                "article_id": d.article_id,
                "guide_text": d.guide_text or "",
                "seed_question": d.seed_question,
                "main_question": (json.loads(d.lesson_json).get("main_question") if d.lesson_json else None),
                "status": d.status,
            } for d in days],
        }

    # ── start_day helpers ──────────────────────────────────────────

    def _build_lesson_prompt(self, topic: str, focus: str) -> str:
        """Build the LLM prompt for generating a structured lesson plan JSON."""
        return f"""你是一位儿童阅读教育专家。请为以下话题生成一篇精读教案。

话题：{topic}
精读焦点：{focus}

返回严格的 JSON 格式（不要包含任何其他文字）：

{{
  "main_question": "这篇文章要搞懂的核心问题（一个完整的问句，适合小学生）",
  "pre_reading": {{
    "background": "2-3句背景小知识，关联孩子的生活经验",
    "hook": "用孩子能懂的语言抛出主问题，告诉他答案藏在文章里"
  }},
  "paragraphs": [
    {{
      "text": "文章第1段，150-200字",
      "clue_prompt": "这段里有解决主问题的什么线索？引导孩子找出来",
      "clue_hint": "这段的关键线索是什么"
    }},
    {{
      "text": "文章第2段，150-200字",
      "clue_prompt": "这段告诉我们什么新信息？",
      "clue_hint": "这段的关键线索"
    }},
    {{
      "text": "文章第3段，150-200字",
      "clue_prompt": "最后这段补充了什么？",
      "clue_hint": "这段的关键线索"
    }}
  ],
  "sub_questions": [
    {{
      "type": "find_clue",
      "label": "找线索",
      "question": "从文章里找到的关键信息是什么？",
      "answer_hint": "孩子应该提到的关键点"
    }},
    {{
      "type": "infer_cause",
      "label": "推因果",
      "question": "为什么会这样？把线索串起来想一想",
      "answer_hint": "因果推理的要点"
    }},
    {{
      "type": "connect_life",
      "label": "联生活",
      "question": "你有没有见过或经历过类似的事？",
      "answer_hint": "生活中类似的例子"
    }}
  ],
  "extension": {{
    "back_to_main": "现在你能回答最开始的问题了吗？",
    "ai_feedback_hint": "从哪些角度评价孩子的回答"
  }}
}}

要求：
- main_question 是整篇文章的灵魂，子问题都要服务于它
- 3段文章合起来 300-500 字，适合小学生阅读
- 每个 clue_prompt 帮助孩子从该段中找线索，逐步拼出答案
- sub_questions 三个类型：find_clue（从文中找信息）→ infer_cause（推理因果）→ connect_life（联系生活）
- 语言亲切、鼓励性强，像一位耐心的老师在引导"""

    def _try_generate_lesson(self, topic: str, focus: str) -> dict | None:
        """Call LLM to generate a structured lesson plan JSON.
        Returns the parsed lesson dict, or None if JSON parsing failed."""
        llm = Container.llm()
        try:
            result = asyncio.run(llm.generate(
                self._build_lesson_prompt(topic, focus),
                system="你是儿童阅读教育专家，擅长设计探究式精读课程。严格按照要求的 JSON 格式返回。",
                temperature=0.7, max_tokens=2000,
            ))
            content = result.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            return json.loads(content.strip())
        except Exception:
            return None

    def _generate_fallback_article(self, topic: str, focus: str) -> str:
        """Generate a simple article when lesson JSON generation fails."""
        llm = Container.llm()
        result = asyncio.run(llm.generate(
            f"请写一篇儿童短文，主题：{topic}，精读焦点：{focus}。"
            f"适合小学生阅读，300-500字，使用简单易懂的汉字。",
            system="你是儿童教育作家，写生动有趣的短文。",
            temperature=0.7, max_tokens=1000,
        ))
        return result.content

    def _create_article(self, student_id: int, content: str, focus: str,
                        topic_category: str) -> int:
        """Create a DailyArticle record. Flushes to get ID but does NOT commit.
        Caller is responsible for the final commit."""
        from ...models import DailyArticle
        article = DailyArticle(
            student_id=student_id,
            record_date=date.today(),
            topic=f"精读·{focus}",
            content=content,
            character_count=len(content),
            source="ai",
            category="daily",
            topic_category=topic_category,
        )
        self.repo.db.add(article)
        self.repo.db.flush()
        return article.id

    # ── core methods ───────────────────────────────────────────────

    def start_day(self, day_id: int, student_id: int) -> dict:
        day = self.repo.get_plan_day(day_id)
        if not day:
            raise ValueError("PlanDay not found")

        # Step 1: claim seed (commits internally, do before modifying day)
        seed_info = self.repo.claim_pending_seed(student_id)
        if seed_info:
            topic = seed_info["question_text"]
            topic_category = "curiosity"
        else:
            topic = f"{day.topic_category}·{day.focus}"
            topic_category = day.topic_category

        # Step 2: generate lesson/article
        lesson_json = self._try_generate_lesson(topic, day.focus)
        if lesson_json:
            article_content = "\n\n".join(p["text"] for p in lesson_json["paragraphs"])
        else:
            if seed_info:
                self.repo.update_seed_status(seed_info["id"], "pending")
            article_content = self._generate_fallback_article(topic, day.focus)

        # Step 3: create article (flush only, no commit)
        article_id = self._create_article(student_id, article_content, day.focus, topic_category)

        # Step 4: update day — single commit for all changes
        day.status = "reading"
        day.article_id = article_id
        if seed_info:
            day.seed_id = seed_info["id"]
            day.seed_question = topic
        if lesson_json:
            day.lesson_json = json.dumps(lesson_json, ensure_ascii=False)
            day.guide_text = lesson_json["pre_reading"]["hook"]
        elif not day.guide_text:
            day.guide_text = ""
        self.repo.update_day(day)

        return {
            "day_id": day.id,
            "article_id": article_id,
            "guide_text": day.guide_text or "",
            "lesson_json": lesson_json,
            "status": day.status,
        }

    def complete_day(self, day_id: int, student_id: int, answers: list) -> dict:
        day = self.repo.get_plan_day(day_id)
        if not day:
            raise ValueError("PlanDay not found")
        day.status = "completed"
        self.repo.update_day(day)

        records = []
        refs = []
        from ...models import ComprehensionRecord
        for ans in answers:
            record = ComprehensionRecord(
                student_id=student_id, article_id=day.article_id,
                plan_day_id=day.id, focus=day.focus or ans.question_type,
                question=ans.question, correct_answer="",
                child_answer=ans.child_answer, is_correct=ans.is_correct,
            )
            self.repo.db.add(record)
            refs.append(record)
        self.repo.db.commit()
        for r in refs:
            self.repo.db.refresh(r)
            records.append(r.id)

        # Seed completion
        if day.seed_id:
            self.repo.update_seed_status(
                day.seed_id, "converted",
                converted_article_id=day.article_id,
            )

        # Save main-question answer as Theory
        main_answer = next((a for a in answers if a.question_type == "main_question"), None)
        theory_id = None
        if main_answer and main_answer.child_answer:
            try:
                from ...models import Theory
                theory = Theory(
                    student_id=student_id,
                    title=main_answer.question[:50],
                    content=main_answer.child_answer,
                    linked_article_id=day.article_id,
                )
                self.repo.db.add(theory)
                self.repo.db.commit()
                self.repo.db.refresh(theory)
                theory_id = theory.id
            except Exception:
                pass

        return {"ok": True, "record_ids": records, "theory_id": theory_id}
