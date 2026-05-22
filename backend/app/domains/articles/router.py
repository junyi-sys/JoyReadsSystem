from fastapi import APIRouter

router = APIRouter(prefix="/api/articles", tags=["文章"])


@router.get("/today")
def get_today():
    return {"message": "coming soon"}
