import os
from pydantic_settings import BaseSettings

_APP_ENV = os.getenv("APP_ENV", "development")


class Settings(BaseSettings):
    # Environment
    APP_ENV: str = "development"
    APP_PORT: int = 8002

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "junyi_reading_dev"

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
    COGNITION_MAX_LEVEL: int = 6

    COGNITION_LEVEL_LABELS: dict[int, str] = {
        0: "学前",
        1: "一年级",
        2: "二年级",
        3: "三年级",
        4: "四年级",
        5: "五年级",
        6: "六年级",
    }

    LEVEL_THRESHOLDS: dict[int, dict[str, int]] = {
        1: {"articles": 5, "chars": 10},
        2: {"articles": 20, "chars": 50},
        3: {"articles": 50, "chars": 150},
        4: {"articles": 100, "chars": 300},
        5: {"articles": 200, "chars": 500},
        6: {"articles": 350, "chars": 800},
    }

    ADVANCED_KEYWORDS: list[str] = [
        "因为", "所以", "但是", "虽然", "如果", "如何", "为什么",
        "怎么", "原理", "分子", "原子", "细胞", "基因", "宇宙",
        "进化", "黑洞", "量子",
    ]

    COGNITION_PROMPTS: dict[int, str] = {
        0: "用最简单的词语和短句，像在跟小宝宝说话。多用叠词（如'高高的'、'圆圆的'）和重复句式。每句话不超过8个字。重点教常见物品名称和简单动作。",
        1: "用简单的语言解释，像在给一年级小朋友讲故事。多用比喻和日常例子，每句话不超过15个字。可以描述简单的顺序和数量关系。",
        2: "用小学生能理解的语言解释，多用孩子熟悉的场景举例。可以引入简单的因果关系，每句话不超过20个字。可以使用'因为''所以'等简单连接词。",
        3: "用清晰准确的语言解释，可以引入基础科学概念。使用更丰富的词汇，每句话不超过25个字。鼓励思考和提问，可以用'为什么''怎么样'引导。",
        4: "用准确而生动的语言解释，可以引入抽象概念。使用多样的句式，包括条件、转折、递进。鼓励比较分析和分类思考。",
        5: "用丰富而精准的语言解释，可以讨论多角度话题。使用成熟的表达方式，包含分析推理和评价判断。引导孩子形成自己的观点。",
        6: "用接近成人的成熟语言解释，可以探讨深层逻辑和复杂关系。鼓励批判性思维、知识迁移和创造性表达。为初中学习做准备。",
    }

    model_config = {
        "env_file": (f".env.{_APP_ENV}", ".env"),
        "env_file_encoding": "utf-8",
    }


settings = Settings()
