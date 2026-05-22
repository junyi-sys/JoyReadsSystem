import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "junyi_word_v2"

    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"

    # AI Providers
    LLM_PROVIDER: str = "deepseek"
    IMAGE_PROVIDER: str = "cogview"
    TTS_PROVIDER: str = "edgetts"

    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-chat"

    GLM_API_KEY: str = ""
    GLM_IMAGE_MODEL: str = "cogview-3-plus"

    # Education
    COGNITION_MAX_LEVEL: int = 3
    ADVANCED_KEYWORDS: list[str] = [
        "因为", "所以", "但是", "虽然", "如果", "如何", "为什么",
        "怎么", "原理", "分子", "原子", "细胞", "基因", "宇宙",
        "进化", "黑洞", "量子",
    ]

    COGNITION_PROMPTS: dict = {
        1: "用最简单的语言解释，多用比喻和日常例子，像在给幼儿园小朋友讲故事。每个概念用一句话说明。",
        2: "用小学生能理解的语言解释，可以引入简单的因果关系，用孩子熟悉的场景举例。",
        3: "用清晰准确的语言解释，可以引入基础科学概念，鼓励思考和提问。",
    }

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
