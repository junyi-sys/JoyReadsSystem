from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class AdvancedConcept(Base, TimestampMixin):
    __tablename__ = "advanced_concept"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    concept: Mapped[str] = mapped_column(String(100), nullable=False, comment="概念名称")
