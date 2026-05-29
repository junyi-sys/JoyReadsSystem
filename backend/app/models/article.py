from datetime import date
from sqlalchemy import String, Integer, Text, Date, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class DailyArticle(Base, TimestampMixin):
    __tablename__ = "daily_article"
    __table_args__ = (
        UniqueConstraint("series_id", "chapter_number", name="uq_series_chapter"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False, comment="关联日期")
    topic: Mapped[str] = mapped_column(String(200), nullable=False, comment="文章标题")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="全文内容")
    character_count: Mapped[int] = mapped_column(Integer, default=0, comment="总字数")
    source: Mapped[str] = mapped_column(String(20), default="ai", comment="ai|manual")
    category: Mapped[str] = mapped_column(String(20), default="daily", comment="daily|answer|series")
    topic_category: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="天文|科学|生命|历史|地理|文学|数学|工程|社会|其他")
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True, comment="封面图URL")
    images_json: Mapped[list | None] = mapped_column(JSON, nullable=True, comment="段落配图列表")
    series_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("article_series.id"), nullable=True, index=True)
    chapter_number: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="章序号 1/2/3...")


class ArticleSeries(Base, TimestampMixin):
    __tablename__ = "article_series"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    curiosity_event_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("curiosity_event.id"), nullable=True)
    topic: Mapped[str] = mapped_column(String(200), nullable=False, comment="系列主题")
    status: Mapped[str] = mapped_column(String(20), default="in_progress", comment="in_progress|completed|abandoned")
    total_chapters: Mapped[int] = mapped_column(Integer, default=3, comment="计划总章数")
    current_chapter: Mapped[int] = mapped_column(Integer, default=0, comment="已生成的章数")
    chapter_titles_json: Mapped[list | None] = mapped_column(JSON, nullable=True, comment="[{ch,title,summary}]")
