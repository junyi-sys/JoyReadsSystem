from datetime import date
from sqlalchemy import String, Integer, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class TargetCharacter(Base, TimestampMixin):
    """目标区：正在学习的字"""
    __tablename__ = "target_character"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    character: Mapped[str] = mapped_column(String(1), nullable=False, comment="汉字")
    added_date: Mapped[date] = mapped_column(Date, nullable=False)


class ScoutCharacter(Base, TimestampMixin):
    """侦查区：即将引入的字"""
    __tablename__ = "scout_character"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    character: Mapped[str] = mapped_column(String(1), nullable=False)
    added_date: Mapped[date] = mapped_column(Date, nullable=False)


class AllyCharacter(Base, TimestampMixin):
    """盟友区：已掌握的字"""
    __tablename__ = "ally_character"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    character: Mapped[str] = mapped_column(String(1), nullable=False)
    mastered_date: Mapped[date] = mapped_column(Date, nullable=False)


class LostCharacter(Base, TimestampMixin):
    """丢失区：被遗忘的字"""
    __tablename__ = "lost_character"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    character: Mapped[str] = mapped_column(String(1), nullable=False)
    lost_date: Mapped[date] = mapped_column(Date, nullable=False)


class DailyCharacter(Base, TimestampMixin):
    """每日生字记录"""
    __tablename__ = "daily_character"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    character: Mapped[str] = mapped_column(String(1), nullable=False)
    category: Mapped[str] = mapped_column(String(20), default="chinese")
