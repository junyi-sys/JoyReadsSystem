import uuid
from sqlalchemy.orm import Session
from ...ai.base import LLMProvider
from .repository import CuriosityRepository
from .graph import get_curiosity_graph


class CuriosityService:
    def __init__(self, db: Session, llm: LLMProvider):
        self.repo = CuriosityRepository(db)
        self.db = db
        self.llm = llm

    def get_events(self, student_id: int, answered: bool | None = None, limit: int = 50, offset: int = 0) -> list[dict]:
        events = self.repo.get_events(student_id, answered, limit, offset)
        return [{
            "id": e.id, "student_id": e.student_id,
            "raw_text": e.raw_text, "tags_json": e.tags_json,
            "mode": e.mode, "is_answered": e.is_answered,
            "linked_article_id": e.linked_article_id,
            "intensity_score": e.intensity_score,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        } for e in events]

    def ask_one_shot(self, student_id: int, raw_text: str, tags: list[str] | None = None) -> dict:
        from ...models import CuriosityEvent
        event = CuriosityEvent(
            student_id=student_id, raw_text=raw_text, mode="one_shot",
            tags_json=tags or [],
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)

        graph = get_curiosity_graph()
        config = {"configurable": {"thread_id": f"oneshot_{event.id}_{uuid.uuid4().hex[:6]}"}}
        result = graph.invoke({
            "event_id": event.id, "student_id": student_id,
            "mode": "one_shot", "raw_text": raw_text,
        }, config)

        if result.get("error"):
            return {"error": result["error"], "event_id": event.id}

        return {
            "event_id": event.id,
            "article_id": result.get("article_id"),
            "article_content": result.get("article_content", ""),
            "paragraphs": result.get("paragraphs", []),
        }

    def start_series(self, student_id: int, raw_text: str) -> dict:
        from ...models import CuriosityEvent, ArticleSeries
        event = CuriosityEvent(
            student_id=student_id, raw_text=raw_text, mode="series",
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)

        series = ArticleSeries(
            student_id=student_id, topic=raw_text,
            curiosity_event_id=event.id,
            status="in_progress", current_chapter=0,
        )
        self.db.add(series)
        self.db.commit()
        self.db.refresh(series)

        graph = get_curiosity_graph()
        config = {"configurable": {"thread_id": f"series_start_{event.id}_{uuid.uuid4().hex[:6]}"}}
        result = graph.invoke({
            "event_id": event.id, "student_id": student_id,
            "mode": "series", "series_id": series.id,
            "raw_text": raw_text,
        }, config)

        if result.get("error"):
            return {"error": result["error"], "event_id": event.id, "series_id": series.id}

        # Save chapter titles to DB
        chapters = result.get("chapter_titles", [])
        series.total_chapters = len(chapters)
        series.chapter_titles_json = chapters
        series.current_chapter = 1
        self.db.commit()

        return {
            "series_id": series.id,
            "event_id": event.id,
            "total_chapters": len(chapters),
            "current_chapter": 1,
            "chapter_titles": chapters,
            "article_id": result.get("article_id"),
            "article_content": result.get("article_content", ""),
            "paragraphs": result.get("paragraphs", []),
        }

    def series_next(self, event_id: int, student_id: int, want_next: bool, user_question: str | None = None) -> dict:
        from ...models import ArticleSeries as AS
        from ...database import SessionLocal

        # Read state from DB
        db = SessionLocal()
        try:
            s = db.query(AS).filter(
                AS.curiosity_event_id == event_id,
                AS.student_id == student_id,
            ).order_by(AS.id.desc()).first()
            if not s:
                return {"error": "未找到系列"}
            series_id = s.id
            db_chapter = s.current_chapter
            db_total = s.total_chapters
            db_titles = s.chapter_titles_json or []
            db_topic = s.topic
            current_status = s.status

            # Status guard: reject if abandoned or completed
            if current_status == "abandoned":
                return {"error": "系列已放弃", "series_id": series_id, "status": "abandoned"}
            if current_status == "completed":
                return {"series_id": series_id, "current_chapter": db_chapter,
                        "total_chapters": db_total, "completed": True, "status": "completed"}

            if not want_next:
                s.status = "abandoned"
                db.commit()
                return {"status": "abandoned", "series_id": series_id}

            # Early return: all chapters already generated
            if db_chapter >= db_total:
                s.status = "completed"
                db.commit()
                return {"series_id": series_id, "current_chapter": db_chapter,
                        "total_chapters": db_total, "completed": True, "status": "completed"}
        finally:
            db.close()

        # Generate next chapter
        graph = get_curiosity_graph()
        config = {"configurable": {"thread_id": f"series_ch_{series_id}_{db_chapter}_{uuid.uuid4().hex[:6]}"}}
        invoke_state = {
            "event_id": event_id, "student_id": student_id,
            "mode": "series", "series_id": series_id,
            "raw_text": db_topic,
            "current_chapter": db_chapter,
            "chapter_titles": db_titles,
        }
        if user_question:
            invoke_state["user_question"] = user_question

        result = graph.invoke(invoke_state, config)

        if result.get("error"):
            return {"error": result["error"]}

        new_chapter = db_chapter + 1
        is_done = new_chapter >= db_total

        # Update DB
        db2 = SessionLocal()
        try:
            series = db2.query(AS).filter(AS.id == series_id).first()
            if series:
                series.current_chapter = new_chapter
                if is_done:
                    series.status = "completed"
                db2.commit()
        finally:
            db2.close()

        return {
            "series_id": series_id,
            "article_id": result.get("article_id"),
            "article_content": result.get("article_content", ""),
            "paragraphs": result.get("paragraphs", []),
            "current_chapter": new_chapter,
            "total_chapters": db_total,
            "completed": is_done,
        }
