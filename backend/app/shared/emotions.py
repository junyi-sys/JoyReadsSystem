EMOTION_PROMPTS = {
    "boast": {
        "label": "炫耀",
        "strategy": "接住再抛回——肯定孩子的发现，顺势提出更有趣的问题让对话继续",
        "reply_template": "哇，你发现了{keyword}！真厉害！那你知道{keyword}还有什么有趣的秘密吗？",
    },
    "confused": {
        "label": "迷茫",
        "strategy": "共情搭梯子——先说'没关系'，再用简单比喻帮孩子理解",
        "reply_template": "没关系，{keyword}确实有点难懂。想象一下，{keyword}就像……",
    },
    "conflict": {
        "label": "冲突",
        "strategy": "认可再反问——先肯定孩子的想法，再引导思考不同角度",
        "reply_template": "你的想法很有趣！不过如果从另一个角度看{keyword}……你觉得会怎样？",
    },
    "ignorant": {
        "label": "无知",
        "strategy": "保护再比喻——不让孩子觉得自己笨，用生活化的比喻解释",
        "reply_template": "这个问题问得好！{keyword}其实就像我们生活中的……",
    },
    "neutral": {
        "label": "中性",
        "strategy": "自然回应——简短回应后引导到文章相关话题",
        "reply_template": "嗯嗯，说得对！对了，文章里还提到了{keyword}，你注意到了吗？",
    },
}


def build_emotion_detection_prompt(text: str, article_context: str = "", main_question: str = "") -> str:
    emotions_desc = "\n".join(
        f"- {k}: {v['label']}（{v['strategy']}）"
        for k, v in EMOTION_PROMPTS.items()
    )
    return f"""分析孩子说的话，判断情绪类型。

文章话题：{article_context}
精读主问题：{main_question}
孩子说的话："{text}"

情绪类型：
{emotions_desc}

只返回JSON：{{"emotion": "类型", "emotion_label": "中文标签", "confidence": 0.0-1.0, "keyword": "关键词"}}"""