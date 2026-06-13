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

        def _extract_guide_text(raw_guide: str | None) -> str:
            """从 guide_text 中提取纯文本导读语。如果是 JSON（种子来源），解析出 guide 字段。"""
            if not raw_guide:
                return ""
            try:
                data = json.loads(raw_guide)
                if isinstance(data, dict) and "guide" in data:
                    return data["guide"]
            except (json.JSONDecodeError, TypeError):
                pass
            return raw_guide

        return {
            "id": plan.id, "name": plan.name, "status": plan.status,
            "start_date": str(plan.start_date), "end_date": str(plan.end_date),
            "current_week": plan.current_week, "week_count": plan.week_count,
            "days": [{
                "id": d.id, "week_number": d.week_number, "day_of_week": d.day_of_week,
                "topic_category": d.topic_category, "focus": d.focus,
                "article_id": d.article_id,
                "guide_text": _extract_guide_text(d.guide_text),
                "status": d.status,
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
            seed_id = seed_info["id"]
            topic = seed_info["question_text"]
            topic_category = "curiosity"
        else:
            topic = f"{day.topic_category}·{day.focus}"
            topic_category = day.topic_category

        # --- LLM 生成完整教案 JSON ---
        lesson_prompt = f"""你是一位儿童阅读教育专家。请为以下话题生成一篇精读教案。

话题：{topic}
精读焦点：{day.focus}

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
      "clue_hint": "这段的关键线索是什么（供AI判断孩子答案时参考）"
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
      "question": "从文章里找到的关键信息是什么？（引导孩子回顾文中细节）",
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
    "back_to_main": "现在你能回答最开始的问题了吗？（用主问题本身的表述）",
    "ai_feedback_hint": "从哪些角度评价孩子的回答"
  }}
}}

要求：
- main_question 是整篇文章的灵魂，子问题都要服务于它
- 3段文章合起来 300-500 字，适合小学生阅读
- 每个 clue_prompt 帮助孩子从该段中找线索，逐步拼出答案
- sub_questions 三个类型：find_clue（从文中找信息）→ infer_cause（推理因果）→ connect_life（联系生活）
- 语言亲切、鼓励性强，像一位耐心的老师在引导"""

        llm = Container.llm()
        try:
            result = asyncio.run(llm.generate(
                lesson_prompt,
                system="你是儿童阅读教育专家，擅长设计探究式精读课程。严格按照要求的 JSON 格式返回。",
                temperature=0.7, max_tokens=2000,
            ))
            # Clean markdown code fences if present
            content = result.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            lesson_json = json.loads(content)
        except Exception:
            # JSON 解析失败，回退到旧模式
            if seed_id:
                self.repo.update_seed_status(seed_id, "pending")
            lesson_json = None

        if lesson_json is None:
            # 回退：生成简单文章
            fallback_prompt = (
                f"请写一篇儿童短文，主题：{topic}，精读焦点：{day.focus}。"
                f"适合小学生阅读，300-500字，使用简单易懂的汉字。"
            )
            try:
                result = asyncio.run(llm.generate(
                    fallback_prompt,
                    system="你是儿童教育作家，写生动有趣的短文。",
                    temperature=0.7, max_tokens=1000,
                ))
            except Exception:
                if seed_id:
                    self.repo.update_seed_status(seed_id, "pending")
                raise
            article_content = result.content
            guide_text_json = original_guide
        else:
            article_content = "\n\n".join(p["text"] for p in lesson_json["paragraphs"])
            guide_data = {
                "version": "v2",
                "main_question": lesson_json["main_question"],
                "lesson": lesson_json,
            }
            # Carry forward seed info if present
            if seed_id:
                guide_data["source"] = "curiosity_seed"
                guide_data["seed_id"] = seed_id
                guide_data["seed_question"] = topic
            guide_text_json = json.dumps(guide_data, ensure_ascii=False)

        # Save seed info for v1 fallback case
        if seed_id and lesson_json is None:
            guide_text_json = json.dumps({
                "source": "curiosity_seed",
                "seed_id": seed_id,
                "seed_question": topic,
                "guide": original_guide,
            }, ensure_ascii=False)

        day.guide_text = guide_text_json

        from ...models import DailyArticle
        article = DailyArticle(
            student_id=student_id,
            record_date=date.today(),
            topic=f"精读·{day.focus}",
            content=article_content,
            character_count=len(article_content),
            source="ai",
            category="daily",
            topic_category=topic_category,
        )
        self.repo.db.add(article)
        self.repo.db.commit()
        self.repo.db.refresh(article)

        day.article_id = article.id
        self.repo.update_day(day)

        return_guide = original_guide
        if lesson_json:
            return_guide = lesson_json["pre_reading"]["hook"]

        return {
            "day_id": day.id,
            "article_id": article.id,
            "guide_text": return_guide,
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
        from ...models import ComprehensionRecord
        for ans in answers:
            record = ComprehensionRecord(
                student_id=student_id, article_id=day.article_id,
                plan_day_id=day.id, focus=ans.question_type,
                question=ans.question, correct_answer="",
                child_answer=ans.child_answer, is_correct=ans.is_correct,
            )
            self.repo.db.add(record)
            self.repo.db.commit()
            self.repo.db.refresh(record)
            records.append(record.id)

        # --- 种子状态联动 ---
        if day.guide_text:
            try:
                data = json.loads(day.guide_text)
                seed_id = data.get("seed_id")
                if seed_id:
                    self.repo.update_seed_status(
                        seed_id, "converted",
                        converted_article_id=day.article_id,
                    )
            except (json.JSONDecodeError, TypeError):
                pass
        # --- 种子状态联动结束 ---

        # --- 主问题回答保存为 Theory ---
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
