from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class Theory(Base, TimestampMixin):
    __tablename__ = "theory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="理论名称")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="理论内容（孩子的想法）")
    linked_curiosity_event_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("curiosity_event.id"), nullable=True
    )
    linked_article_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("daily_article.id"), nullable=True
    )
