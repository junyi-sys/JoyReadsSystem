from datetime import date
from sqlalchemy import String, Integer, Text, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class ReadingPlan(Base, TimestampMixin):
    __tablename__ = "reading_plan"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="计划名称")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", comment="active|completed|paused")
    week_count: Mapped[int] = mapped_column(Integer, default=4)
    current_week: Mapped[int] = mapped_column(Integer, default=1)


class PlanDay(Base, TimestampMixin):
    __tablename__ = "plan_day"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(Integer, ForeignKey("reading_plan.id"), nullable=False, index=True)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False, comment="0=Sun..4=Thu")
    topic_category: Mapped[str] = mapped_column(String(50), nullable=False)
    focus: Mapped[str] = mapped_column(String(20), nullable=False)
    article_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("daily_article.id"), nullable=True)
    guide_text: Mapped[str | None] = mapped_column(Text, nullable=True, comment="导读语")
    status: Mapped[str] = mapped_column(String(20), default="pending", comment="pending|reading|completed|skipped")
