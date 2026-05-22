from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta

from ...database import get_db
from ...shared.middleware import get_current_student_id
from ...models import DailyArticle, ArticleReadStatus, AllyCharacter, TargetCharacter, ScoutCharacter, LostCharacter

router = APIRouter(prefix="/api/stats", tags=["统计"])


@router.get("/overview")
def get_stats_overview(student_id: int = Depends(get_current_student_id),
                       db: Session = Depends(get_db)):
    total_read = db.query(ArticleReadStatus).filter(
        ArticleReadStatus.student_id == student_id,
        ArticleReadStatus.status == "read",
    ).count()

    week_ago = date.today() - timedelta(days=7)
    weekly = db.query(DailyArticle).filter(
        DailyArticle.student_id == student_id,
        DailyArticle.record_date >= week_ago,
    ).count()

    total_chars = db.query(AllyCharacter).filter(
        AllyCharacter.student_id == student_id
    ).count()

    zone_stats = {
        "target": db.query(TargetCharacter).filter(TargetCharacter.student_id == student_id).count(),
        "scout": db.query(ScoutCharacter).filter(ScoutCharacter.student_id == student_id).count(),
        "ally": db.query(AllyCharacter).filter(AllyCharacter.student_id == student_id).count(),
        "lost": db.query(LostCharacter).filter(LostCharacter.student_id == student_id).count(),
    }
    zone_stats["total"] = sum(zone_stats.values())

    streak = 0
    today = date.today()
    for i in range(30):
        d = today - timedelta(days=i)
        has = db.query(DailyArticle).filter(
            DailyArticle.student_id == student_id,
            DailyArticle.record_date == d,
        ).count() > 0
        if has:
            streak += 1
        else:
            break

    return {
        "total_characters_learned": total_chars,
        "total_articles_read": total_read,
        "current_streak": streak,
        "weekly_articles": weekly,
        "zone_distribution": zone_stats,
        "recent_activity": [],
    }
