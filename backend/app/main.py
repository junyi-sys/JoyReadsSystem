from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import init_db

app = FastAPI(title="俊宜阅读", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
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
            db.add(Student(id=1, name="默认学生", age=5, cognition_level=0))
            db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


from .shared.exceptions import global_exception_handler
app.add_exception_handler(Exception, global_exception_handler)


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
from .domains.stt.router import router as stt_router
app.include_router(stt_router)
from .domains.theory.router import router as theory_router
app.include_router(theory_router)
from .domains.seeds.router import router as seeds_router
app.include_router(seeds_router)
from .domains.plan.router import router as plan_router
app.include_router(plan_router)
from .domains.knowledge.router import router as knowledge_router
app.include_router(knowledge_router)
from .domains.radar.router import router as radar_router
app.include_router(radar_router)
from .domains.parent.router import router as parent_router
app.include_router(parent_router)
from .domains.companion.router import router as companion_router
app.include_router(companion_router)
from .domains.concepts.router import router as concepts_router
app.include_router(concepts_router)
