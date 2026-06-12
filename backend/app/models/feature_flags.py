from sqlalchemy import Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class StudentFeatureFlags(Base, TimestampMixin):
    __tablename__ = "student_feature_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, unique=True, index=True)
    socratic_enabled: Mapped[bool] = mapped_column(Boolean, default=True, comment="反问引导")
    seed_auto_grow: Mapped[bool] = mapped_column(Boolean, default=True, comment="种子自动生长")
    ai_review_enabled: Mapped[bool] = mapped_column(Boolean, default=True, comment="AI归纳点评")
    reading_plan_enabled: Mapped[bool] = mapped_column(Boolean, default=True, comment="精读计划")
