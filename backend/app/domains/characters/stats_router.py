from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta

from ...database import get_db
from ...shared.middleware import get_current_student_id
from ...models import DailyArticle, ArticleReadStatus, Character

router = APIRouter(prefix="/api/stats", tags=["统计"])


@router.get("/overview")
def get_stats_overview(
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    total_read = (
        db.query(ArticleReadStatus)
        .filter(
            ArticleReadStatus.student_id == student_id,
            ArticleReadStatus.status == "read",
        )
        .count()
    )

    week_ago = date.today() - timedelta(days=7)
    weekly = (
        db.query(DailyArticle)
        .filter(
            DailyArticle.student_id == student_id,
            DailyArticle.record_date >= week_ago,
        )
        .count()
    )

    ally_count = (
        db.query(Character)
        .filter(Character.student_id == student_id, Character.zone == "ally")
        .count()
    )

    zone_stats = {}
    for z in ("target", "scout", "ally", "lost"):
        zone_stats[z] = (
            db.query(Character)
            .filter(Character.student_id == student_id, Character.zone == z)
            .count()
        )
    zone_stats["total"] = sum(zone_stats.values())

    streak = 0
    today = date.today()
    for i in range(30):
        d = today - timedelta(days=i)
        has = (
            db.query(DailyArticle)
            .filter(
                DailyArticle.student_id == student_id,
                DailyArticle.record_date == d,
            )
            .count()
            > 0
        )
        if has:
            streak += 1
        else:
            break

    return {
        "total_characters_learned": ally_count,
        "total_articles_read": total_read,
        "current_streak": streak,
        "weekly_articles": weekly,
        "zone_distribution": zone_stats,
        "recent_activity": [],
    }
