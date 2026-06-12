from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class CuriositySeed(Base, TimestampMixin):
    __tablename__ = "curiosity_seed"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    question_text: Mapped[str] = mapped_column(String(500), nullable=False, comment="孩子的问题")
    source: Mapped[str] = mapped_column(String(30), default="curiosity_chat")
    source_article_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("daily_article.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", comment="pending|growing|converted|skipped")
    converted_article_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("daily_article.id"), nullable=True)
