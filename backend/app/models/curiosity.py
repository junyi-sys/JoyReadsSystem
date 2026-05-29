from sqlalchemy import String, Integer, Text, JSON, Boolean, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class CuriosityEvent(Base, TimestampMixin):
    __tablename__ = "curiosity_event"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    raw_text: Mapped[str] = mapped_column(String(500), nullable=False, comment="孩子原始提问")
    tags_json: Mapped[list | None] = mapped_column(JSON, nullable=True, comment="兴趣标签")
    mode: Mapped[str] = mapped_column(String(20), default="one_shot", comment="one_shot|series")
    is_answered: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否已生成回答")
    linked_article_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("daily_article.id"), nullable=True)
    intensity_score: Mapped[float] = mapped_column(Float, default=0.5, comment="兴趣强度 0-1")
    socratic_mode: Mapped[bool] = mapped_column(Boolean, default=False, comment="苏格拉底追问模式")
    follow_up_question: Mapped[str | None] = mapped_column(Text, nullable=True, comment="AI反问孩子的问题")
    child_response: Mapped[str | None] = mapped_column(Text, nullable=True, comment="孩子对AI反问的回答")
    theory_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("theory.id"), nullable=True)
