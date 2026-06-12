from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.shared.middleware import get_current_student_id
from .service import SeedService

router = APIRouter(prefix="/api/seeds", tags=["种子池"])


@router.get("")
def list_seeds(status: str | None = None, student_id: int = Depends(get_current_student_id),
               db: Session = Depends(get_db)):
    svc = SeedService(db)
    return svc.list_seeds(student_id, status)


@router.post("/{seed_id}/grow")
def grow_seed(seed_id: int, student_id: int = Depends(get_current_student_id),
              db: Session = Depends(get_db)):
    svc = SeedService(db)
    result = svc.grow_seed(seed_id, student_id)
    if not result:
        raise HTTPException(status_code=400, detail="种子不存在或已处理")
    return result


@router.post("/auto-grow")
def auto_grow(student_id: int = Depends(get_current_student_id),
              db: Session = Depends(get_db)):
    svc = SeedService(db)
    return svc.auto_grow_weekly(student_id)


@router.delete("/{seed_id}")
def delete_seed(seed_id: int, student_id: int = Depends(get_current_student_id),
                db: Session = Depends(get_db)):
    svc = SeedService(db)
    ok = svc.repo.delete(seed_id, student_id)
    if not ok:
        raise HTTPException(status_code=404, detail="种子不存在")
    return {"ok": True}
