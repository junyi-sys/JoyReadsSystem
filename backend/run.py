import sys, uvicorn
if __name__ == "__main__":
    port = 8001 if sys.getenv("DB_NAME") == "junyi_word_dev" else 8000
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
