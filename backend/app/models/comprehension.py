from sqlalchemy import String, Integer, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class ComprehensionRecord(Base, TimestampMixin):
    __tablename__ = "comprehension_record"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    article_id: Mapped[int] = mapped_column(Integer, ForeignKey("daily_article.id"), nullable=False)
    plan_day_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("plan_day.id"), nullable=True)
    focus: Mapped[str] = mapped_column(String(20), nullable=False, comment="精读焦点")
    question: Mapped[str] = mapped_column(Text, nullable=False, comment="题目文本")
    correct_answer: Mapped[str] = mapped_column(String(200), nullable=False)
    child_answer: Mapped[str] = mapped_column(String(200), nullable=False, comment="孩子答案")
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
