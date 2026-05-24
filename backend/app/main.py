from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db

app = FastAPI(title="俊宜阅读", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    from .database import SessionLocal
    from .models import Student
    init_db()
    db = SessionLocal()
    try:
        if db.query(Student).count() == 0:
            db.add(Student(id=1, name="默认学生", age=7, cognition_level=1))
            db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


# Register domain routers
from .domains.articles.router import router as articles_router
app.include_router(articles_router)
from .domains.characters.router import router as characters_router
app.include_router(characters_router)
from .domains.curiosity.router import router as curiosity_router
app.include_router(curiosity_router)
from .domains.tts.router import router as tts_router
app.include_router(tts_router)
from .domains.characters.stats_router import router as stats_router
app.include_router(stats_router)
from .domains.students.router import router as students_router
app.include_router(students_router)
