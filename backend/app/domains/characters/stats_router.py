from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta

from ...database import get_db
from ...shared.middleware import get_current_student_id
from ...models import DailyArticle, ArticleReadStatus, Character
from ...domains.articles.categories import TOPIC_CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS

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


@router.get("/categories")
def get_category_stats(
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    """Return article count per topic category."""
    rows = (
        db.query(DailyArticle.topic_category, func.count(DailyArticle.id))
        .filter(
            DailyArticle.student_id == student_id,
            DailyArticle.topic_category.isnot(None),
        )
        .group_by(DailyArticle.topic_category)
        .all()
    )

    category_counts = {cat: 0 for cat in TOPIC_CATEGORIES}
    for cat, cnt in rows:
        if cat in category_counts:
            category_counts[cat] = cnt
        else:
            category_counts["其他"] += cnt

    total = sum(category_counts.values())

    items = []
    for cat in TOPIC_CATEGORIES:
        cnt = category_counts.get(cat, 0)
        if cnt > 0 or cat == "其他":
            items.append({
                "category": cat,
                "count": cnt,
                "icon": CATEGORY_ICONS.get(cat, "📌"),
                "color": CATEGORY_COLORS.get(cat, "#8c8c8c"),
                "percent": round(cnt / total * 100, 1) if total > 0 else 0,
            })

    return {"items": items, "total": total}
