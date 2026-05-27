from datetime import date
from sqlalchemy.orm import Session
from ...config import settings as cfg
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
        return self._to_response(article, student_id)
    def get_article(self, article_id: int, student_id: int) -> dict:
        article = self.repo.get_by_id(article_id, student_id)
        if not article:
            from ...shared.exceptions import NotFoundError
            raise NotFoundError("文章不存在")
        return self._to_response(article, student_id)
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
                       category: str = "daily",
                       density: int | None = None,
                       reinforce: int | None = None) -> dict:
        # Build zone context for article generation
        char_svc = CharacterService(self.db)
        zone_ctx = char_svc.get_zone_context(student_id)
        zone_context = self._format_zone_context(zone_ctx, density, reinforce)

        # Read student's actual cognition level
        from ..students.service import StudentService
        student_svc = StudentService(self.db)
        student = student_svc.get_student(student_id)
        cognition_level = student.cognition_level if student else 0

        result = await generate_article_with_pinyin(
            self.llm, topic, characters, min_chars, max_chars, category,
            cognition_level=cognition_level,
            zone_context=zone_context, summary=summary,
            density=density, reinforce=reinforce,
        )
        content = result["content"]
        today_date = date.today()
        article = DailyArticle(
            student_id=student_id, record_date=today_date, topic=topic,
            content=content, character_count=len(content),
            source="ai", category=category,
        )
        self.repo.save_article(article)
        return self._to_response(article, student_id)

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
            "curiosity_event_id": series.curiosity_event_id,
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

    def _format_zone_context(self, ctx: dict, density: int | None = None,
                             reinforce: int | None = None) -> str:
        """Format zone context for the AI prompt with optional density/reinforce targets."""
        parts = []
        if ctx["ally_chars"]:
            parts.append(f"已掌握的字（可放心使用，接近80%比例）：{'、'.join(ctx['ally_chars'])}")
            parts.append("请用这些字作为文章的主体词汇")
        if ctx["target_chars"]:
            if density is not None:
                # Quantitative: calculate how many new chars to embed
                target_words = ctx["target_chars"]
                parts.append(
                    f"正在学的生字（目标密度：每100字约{density}个生字，请从以下选字自然融入）："
                    f"{'、'.join(target_words)}"
                )
                parts.append(f"请确保这些生字在文章中均匀分布，每个生字至少出现2次")
            else:
                parts.append(f"正在学的字（请多次重复，每个至少出现2次）：{'、'.join(ctx['target_chars'])}")
        if ctx["lost_chars"]:
            if reinforce is not None and reinforce > 0:
                parts.append(
                    f"遇到困难的字（目标密度：每100字约{reinforce}个复习字）："
                    f"{'、'.join(ctx['lost_chars'])}"
                )
                parts.append("请在文章中以不同上下文重复这些字帮助记忆")
            else:
                parts.append(f"遇到困难的字（请反复出现帮助复习）：{'、'.join(ctx['lost_chars'])}")
                parts.append("请在文章中多次重复这些字，每次用在稍有不同的上下文中")
        return "\n".join(parts)

    def calculate_article_params(self, student_id: int, override: dict = {}) -> dict:
        """Calculate recommended article generation parameters based on zone stats."""
        char_svc = CharacterService(self.db)
        zone_ctx = char_svc.get_zone_context(student_id)
        known_count = zone_ctx["total_known"]  # ally + scout

        # Find matching tier
        tier = None
        for t in cfg.ARTICLE_DENSITY_TIERS:
            if known_count <= t["max_known"]:
                tier = t
                break
        if tier is None:
            tier = cfg.ARTICLE_DENSITY_TIERS[-1]

        # Apply optional parent overrides
        min_chars = override.get("min_chars", tier["min_chars"])
        max_chars = override.get("max_chars", tier["max_chars"])
        density = override.get("density", tier["density"])
        reinforce = override.get("reinforce", tier["reinforce"])

        # Get today's newly added characters
        today_chars = char_svc.get_today_new_characters(student_id)

        # Get zone counts
        zone_counts = char_svc.get_stats(student_id)

        return {
            "recommended": {
                "min_chars": tier["min_chars"],
                "max_chars": tier["max_chars"],
                "density": tier["density"],
                "reinforce": tier["reinforce"],
            },
            "current": {
                "min_chars": min_chars,
                "max_chars": max_chars,
                "density": density,
                "reinforce": reinforce,
            },
            "zone_stats": {
                "known_count": known_count,
                "target_count": zone_counts["target"],
                "scout_count": zone_counts["scout"],
                "ally_count": zone_counts["ally"],
                "lost_count": zone_counts["lost"],
                "total": zone_counts["total"],
            },
            "today_new_chars": today_chars,
            "tier_index": cfg.ARTICLE_DENSITY_TIERS.index(tier),
            "total_tiers": len(cfg.ARTICLE_DENSITY_TIERS),
        }

    def on_article_read(self, article_id: int, student_id: int):
        """Trigger character auto-promotion and student level-up when article is marked read."""
        article = self.repo.get_by_id(article_id, student_id)
        if not article:
            return None
        char_svc = CharacterService(self.db)
        char_result = char_svc.on_article_read(article.content, student_id, article_id)

        # Check for student level-up
        from ..students.service import StudentService
        student_svc = StudentService(self.db)
        level_up = student_svc.check_and_level_up(student_id)

        return {"characters": char_result, "level_up": level_up}

    def _to_response(self, article: DailyArticle, student_id: int | None = None) -> dict:
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
        result = {
            "id": article.id, "record_date": article.record_date.isoformat(),
            "topic": article.topic, "content": article.content,
            "character_count": article.character_count,
            "source": article.source, "category": article.category,
            "image_url": article.image_url, "images": article.images_json or [],
            "created_at": article.created_at.isoformat() if article.created_at else None,
            "paragraphs": annotated["paragraphs"],
            **series_info,
        }
        if student_id:
            result["char_stats"] = self._compute_char_stats(article.content, student_id)
        return result

    def _compute_char_stats(self, content: str, student_id: int) -> dict:
        """Compute character zone distribution for the article content."""
        char_svc = CharacterService(self.db)
        today_new = set(char_svc.get_today_new_characters(student_id))

        # Extract unique chars from content
        seen = set()
        article_chars = []
        for ch in content:
            if "一" <= ch <= "鿿" and ch not in seen:
                seen.add(ch)
                article_chars.append(ch)

        total = len(article_chars)
        target_chars = []
        scout_chars = []
        ally_chars = []
        lost_chars = []
        unknown_chars = []
        today_chars = []

        # Get zone mapping for all chars in article
        from ...models import Character as CharModel
        records = (
            self.db.query(CharModel)
            .filter(CharModel.student_id == student_id, CharModel.character.in_(article_chars))
            .all()
        )
        zone_map = {r.character: r.zone.value for r in records}

        for ch in article_chars:
            zone = zone_map.get(ch)
            if zone == "target":
                target_chars.append(ch)
            elif zone == "scout":
                scout_chars.append(ch)
            elif zone == "ally":
                ally_chars.append(ch)
            elif zone == "lost":
                lost_chars.append(ch)
            else:
                unknown_chars.append(ch)
            if ch in today_new:
                today_chars.append(ch)

        return {
            "total": total,
            "target": target_chars,
            "scout": scout_chars,
            "ally": ally_chars,
            "lost": lost_chars,
            "unknown": unknown_chars,
            "today_new": today_chars,
            "zone_counts": {
                "target": len(target_chars),
                "scout": len(scout_chars),
                "ally": len(ally_chars),
                "lost": len(lost_chars),
                "unknown": len(unknown_chars),
                "today_new": len(today_chars),
            },
        }
