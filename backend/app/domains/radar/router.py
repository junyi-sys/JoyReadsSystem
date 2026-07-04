from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...database import get_db
from ...shared.middleware import get_current_student_id
from .service import RadarService

router = APIRouter(prefix="/api/stats", tags=["能力雷达"])


@router.get("/radar")
def get_radar(student_id: int = Depends(get_current_student_id),
              db: Session = Depends(get_db)):
    svc = RadarService(db)
    return svc.compute_radar(student_id)
