import re
from ...ai.base import LLMProvider
from ...config import settings as cfg


def extract_characters_from_text(text: str) -> list[str]:
    """Extract unique Chinese characters from text, preserving order."""
    chars = re.findall(r'[一-鿿]', text)
    return list(dict.fromkeys(chars))


def build_article_prompt(
    topic: str, characters: list[str], min_chars: int, max_chars: int,
    category: str, cognition_level: int, zone_context: str = "",
    memory_context: str = "", summary: str = "",
) -> tuple[str, str]:
    """Build system and user prompts for article generation."""
    cog_guide = cfg.COGNITION_PROMPTS.get(
        min(cognition_level, cfg.COGNITION_MAX_LEVEL),
        cfg.COGNITION_PROMPTS[0],
    )

    label = cfg.COGNITION_LEVEL_LABELS.get(cognition_level, f"{cognition_level}级")
    level_to_age = {0: 4, 1: 6, 2: 7, 3: 8, 4: 9, 5: 10, 6: 11}
    age = level_to_age.get(cognition_level, 7)

    char_str = "、".join(characters[:8]) if characters else "自动选择合适的生字"
    zone_str = f"\n\n【已知字库参考】\n{zone_context}" if zone_context else ""
    mem_str = f"\n\n【学习记忆参考】\n{memory_context}" if memory_context else ""
    summary_str = f"\n\n【主题摘要 - 请围绕以下内容展开文章】\n{summary}" if summary else ""

    system = f"你是儿童教育作家。{cog_guide} 写250-350字的短文，段落清晰，语言生动。"

    prompt = f"""写一篇短文给{age}岁孩子阅读。

标题：{topic}
类型：{category}
字数：{min_chars}-{max_chars}字
需要嵌入的生字：{char_str}
{zone_str}{mem_str}{summary_str}

要求：
1. 内容有趣，像讲故事一样
2. 每个自然段2-4句话
3. 把生字自然地融入文章
4. 用词适合{label}认知水平
5. 只输出文章正文，不需要标题"""

    return system, prompt


async def generate_article_with_pinyin(
    llm: LLMProvider, topic: str, characters: list[str],
    min_chars: int = 100, max_chars: int = 350,
    category: str = "daily", cognition_level: int = 1,
    zone_context: str = "", memory_context: str = "",
    summary: str = "",
) -> dict:
    """Generate an article with AI. Returns dict with 'content' key."""
    system, prompt = build_article_prompt(
        topic, characters, min_chars, max_chars, category,
        cognition_level, zone_context, memory_context, summary,
    )
    result = await llm.generate(prompt, system=system, temperature=0.7, max_tokens=1500)
    content = result.content.strip()
    return {"content": content}
