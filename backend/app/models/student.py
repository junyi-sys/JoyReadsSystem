from sqlalchemy import String, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class Student(Base, TimestampMixin):
    __tablename__ = "student"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="学生姓名")
    age: Mapped[int] = mapped_column(Integer, default=7, comment="年龄")
    cognition_level: Mapped[int] = mapped_column(Integer, default=1, comment="认知等级 1-3")
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True, comment="头像URL")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否启用")
