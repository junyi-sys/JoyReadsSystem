from datetime import date, datetime
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin
import enum


class CharacterZone(str, enum.Enum):
    target = "target"
    scout = "scout"
    ally = "ally"
    lost = "lost"


class Character(Base, TimestampMixin):
    """统一字库表，四个区用 zone 字段区分"""
    __tablename__ = "character"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    character: Mapped[str] = mapped_column(String(1), nullable=False, comment="汉字")
    zone: Mapped[CharacterZone] = mapped_column(
        Enum(CharacterZone, name="character_zone"), nullable=False, default=CharacterZone.target
    )
    tap_count: Mapped[int] = mapped_column(Integer, default=0, comment="累计点读次数")
    appeared_in_articles: Mapped[int] = mapped_column(Integer, default=0, comment="出现过的文章数")
    never_tapped_in_articles: Mapped[int] = mapped_column(Integer, default=0, comment="已读文章中未点读次数")
    first_seen_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_tapped_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    zone_changed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="manual", comment="manual/reading/auto")


class CharacterInteraction(Base, TimestampMixin):
    """点读行为记录"""
    __tablename__ = "character_interaction"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    character: Mapped[str] = mapped_column(String(1), nullable=False)
    article_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("daily_article.id"), nullable=True)


class CharacterZoneLog(Base, TimestampMixin):
    """区变更历史"""
    __tablename__ = "character_zone_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    character: Mapped[str] = mapped_column(String(1), nullable=False)
    from_zone: Mapped[str] = mapped_column(String(10), nullable=False)
    to_zone: Mapped[str] = mapped_column(String(10), nullable=False)
    reason: Mapped[str] = mapped_column(String(20), default="manual", comment="manual/auto_tap/auto_mastery")
    article_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("daily_article.id"), nullable=True)


# Keep DailyCharacter as-is for daily character learning records
class DailyCharacter(Base, TimestampMixin):
    """每日生字记录"""
    __tablename__ = "daily_character"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    character: Mapped[str] = mapped_column(String(1), nullable=False)
    category: Mapped[str] = mapped_column(String(20), default="chinese")
