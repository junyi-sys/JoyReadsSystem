from datetime import date
from sqlalchemy.orm import Session
from ...models import DailyArticle
from ...ai.base import LLMProvider
from ...shared.pinyin import annotate_text
from ..characters.service import CharacterService
from .repository import ArticleRepository
from .generator import generate_article_with_pinyin


class ArticleService:
    def __init__(self, db: Session, llm: LLMProvider):
        self.repo = ArticleRepository(db)
        self.db = db
        self.llm = llm

    def get_today(self, student_id: int) -> dict | None:
        article = self.repo.get_today(student_id, date.today())
        if not article:
            return None
        return self._to_response(article)

    def get_article(self, article_id: int, student_id: int) -> dict:
        article = self.repo.get_by_id(article_id, student_id)
        if not article:
            from ...shared.exceptions import NotFoundError
            raise NotFoundError("文章不存在")
        return self._to_response(article)

    def get_history(self, student_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
        articles = self.repo.get_history(student_id, limit, offset)
        return [{
            "id": a.id, "record_date": a.record_date.isoformat(),
            "topic": a.topic, "character_count": a.character_count,
            "source": a.source, "category": a.category,
            "image_url": a.image_url, "series_id": a.series_id,
        } for a in articles]

    async def generate(self, student_id: int, topic: str, summary: str = "",
                       characters: list[str] = [],
                       min_chars: int = 100, max_chars: int = 350,
                       category: str = "daily") -> dict:
        # Build zone context for article generation
        char_svc = CharacterService(self.db)
        zone_ctx = char_svc.get_zone_context(student_id)
        zone_context = self._format_zone_context(zone_ctx)

        result = await generate_article_with_pinyin(
            self.llm, topic, characters, min_chars, max_chars, category,
            zone_context=zone_context, summary=summary,
        )
        content = result["content"]
        today = date.today()
        article = DailyArticle(
            student_id=student_id, record_date=today, topic=topic,
            content=content, character_count=len(content),
            source="ai", category=category,
        )
        self.repo.save_article(article)
        return self._to_response(article)

    def delete(self, article_id: int, student_id: int) -> bool:
        return self.repo.delete_article(article_id, student_id)

    # ===== Series =====

    def get_series(self, series_id: int, student_id: int) -> dict:
        from ...models import ArticleSeries, ArticleReadStatus
        series = self.repo.get_series(series_id, student_id)
        if not series:
            from ...shared.exceptions import NotFoundError
            raise NotFoundError("系列不存在")

        chapters = self.repo.get_series_chapters(series_id)
        chapter_list = []
        for ch in chapters:
            status_record = self.db.query(ArticleReadStatus).filter(
                ArticleReadStatus.article_id == ch.id,
                ArticleReadStatus.student_id == student_id,
            ).first()
            chapter_list.append({
                "id": ch.id,
                "chapter_number": ch.chapter_number,
                "title": ch.topic,
                "character_count": ch.character_count,
                "read_status": status_record.status if status_record else "unread",
            })

        return {
            "id": series.id,
            "topic": series.topic,
            "status": series.status,
            "total_chapters": series.total_chapters,
            "current_chapter": series.current_chapter,
            "chapter_titles": series.chapter_titles_json or [],
            "chapters": chapter_list,
        }

    def get_series_chapter(self, series_id: int, chapter_number: int, student_id: int) -> dict:
        series = self.repo.get_series(series_id, student_id)
        if not series:
            from ...shared.exceptions import NotFoundError
            raise NotFoundError("系列不存在")
        chapter = self.db.query(DailyArticle).filter(
            DailyArticle.series_id == series_id,
            DailyArticle.chapter_number == chapter_number,
        ).first()
        if not chapter:
            from ...shared.exceptions import NotFoundError
            raise NotFoundError("章节不存在")
        annotated = annotate_text(chapter.content)
        return {
            "id": chapter.id,
            "series_id": series_id,
            "chapter_number": chapter_number,
            "topic": chapter.topic,
            "content": chapter.content,
            "character_count": chapter.character_count,
            "paragraphs": annotated["paragraphs"],
        }

    def _format_zone_context(self, ctx: dict) -> str:
        """Format zone context for the AI prompt."""
        parts = []
        if ctx["ally_chars"]:
            parts.append(f"已掌握的字（可放心使用，接近80%比例）：{'、'.join(ctx['ally_chars'])}")
            parts.append("请用这些字作为文章的主体词汇")
        if ctx["target_chars"]:
            parts.append(f"正在学的字（请多次重复，每个至少出现2次）：{'、'.join(ctx['target_chars'])}")
        if ctx["lost_chars"]:
            parts.append(f"遇到困难的字（请反复出现帮助复习）：{'、'.join(ctx['lost_chars'])}")
            parts.append("请在文章中多次重复这些字，每次用在稍有不同的上下文中")
        return "\n".join(parts)

    def on_article_read(self, article_id: int, student_id: int):
        """Trigger character auto-promotion engine when article is marked read."""
        article = self.repo.get_by_id(article_id, student_id)
        if not article:
            return
        char_svc = CharacterService(self.db)
        return char_svc.on_article_read(article.content, student_id, article_id)

    def _to_response(self, article: DailyArticle) -> dict:
        annotated = annotate_text(article.content)
        series_info = {}
        if article.series_id:
            series = self.repo.get_series(article.series_id, article.student_id)
            if series:
                series_info = {
                    "series_id": series.id,
                    "chapter_number": article.chapter_number,
                    "total_chapters": series.total_chapters,
                }
        return {
            "id": article.id, "record_date": article.record_date.isoformat(),
            "topic": article.topic, "content": article.content,
            "character_count": article.character_count,
            "source": article.source, "category": article.category,
            "image_url": article.image_url, "images": article.images_json or [],
            "created_at": article.created_at.isoformat() if article.created_at else None,
            "paragraphs": annotated["paragraphs"],
            **series_info,
        }
