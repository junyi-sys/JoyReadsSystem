from sqlalchemy import Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class LevelConfig(Base, TimestampMixin):
    __tablename__ = "level_config"
    __table_args__ = (
        UniqueConstraint("student_id", "level", name="uq_student_level"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False, comment="等级编号")
    word_threshold: Mapped[int] = mapped_column(Integer, nullable=False)
    article_threshold: Mapped[int] = mapped_column(Integer, nullable=False)
