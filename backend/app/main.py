from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db

app = FastAPI(title="俊宜识字 v2", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


# Register domain routers
from .domains.articles.router import router as articles_router
app.include_router(articles_router)
from .domains.characters.router import router as characters_router
app.include_router(characters_router)
