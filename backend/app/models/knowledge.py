from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin


class KnowledgeNode(Base, TimestampMixin):
    __tablename__ = "knowledge_node"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    concept: Mapped[str] = mapped_column(String(100), nullable=False, comment="概念名")
    depth: Mapped[int] = mapped_column(Integer, default=1, comment="掌握深度 1-4")
    first_exposed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="curiosity", comment="curiosity|reading|theory|manual")
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True, comment="证据文本")
