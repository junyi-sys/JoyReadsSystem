import os, uvicorn
if __name__ == "__main__":
    from app.config import settings
    print(f"[{settings.APP_ENV}] 启动后端 http://0.0.0.0:{settings.APP_PORT}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.APP_PORT,
                reload=(settings.APP_ENV == "development"),
                http="h11", timeout_keep_alive=5)
