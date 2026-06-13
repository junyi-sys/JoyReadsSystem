from sqlalchemy import String, Integer, Boolean, Text, text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class Student(Base, TimestampMixin):
    __tablename__ = "student"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="学生姓名")
    age: Mapped[int] = mapped_column(Integer, server_default=text("7"), comment="年龄")
    cognition_level: Mapped[int] = mapped_column(Integer, server_default=text("0"), comment="认知等级 0-6")
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True, comment="头像URL")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("1"), comment="是否启用")
    pin_code: Mapped[str | None] = mapped_column(String(6), nullable=True, comment="学生PIN码")
