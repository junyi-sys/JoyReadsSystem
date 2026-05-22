from datetime import date
from sqlalchemy.orm import Session
from ...models import DailyArticle, ArticleSeries


class ArticleRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_today(self, student_id: int, record_date: date) -> DailyArticle | None:
        return self.db.query(DailyArticle).filter(
            DailyArticle.student_id == student_id,
            DailyArticle.record_date == record_date,
        ).order_by(DailyArticle.id.desc()).first()

    def get_by_id(self, article_id: int, student_id: int) -> DailyArticle | None:
        return self.db.query(DailyArticle).filter(
            DailyArticle.id == article_id,
            DailyArticle.student_id == student_id,
        ).first()

    def get_history(self, student_id: int, limit: int = 50, offset: int = 0) -> list[DailyArticle]:
        return self.db.query(DailyArticle).filter(
            DailyArticle.student_id == student_id,
        ).order_by(DailyArticle.record_date.desc()).offset(offset).limit(limit).all()

    def save_article(self, article: DailyArticle) -> DailyArticle:
        self.db.add(article)
        self.db.commit()
        self.db.refresh(article)
        return article

    def delete_article(self, article_id: int, student_id: int) -> bool:
        article = self.get_by_id(article_id, student_id)
        if article:
            self.db.delete(article)
            self.db.commit()
            return True
        return False

    def get_series(self, series_id: int, student_id: int) -> ArticleSeries | None:
        return self.db.query(ArticleSeries).filter(
            ArticleSeries.id == series_id,
            ArticleSeries.student_id == student_id,
        ).first()

    def get_series_chapters(self, series_id: int) -> list[DailyArticle]:
        return self.db.query(DailyArticle).filter(
            DailyArticle.series_id == series_id,
        ).order_by(DailyArticle.chapter_number.asc()).all()

    def save_series(self, series: ArticleSeries) -> ArticleSeries:
        self.db.add(series)
        self.db.commit()
        self.db.refresh(series)
        return series

    def update_series_fields(self, series_id: int, **kwargs):
        series = self.db.query(ArticleSeries).filter(ArticleSeries.id == series_id).first()
        if series:
            for k, v in kwargs.items():
                setattr(series, k, v)
            self.db.commit()
