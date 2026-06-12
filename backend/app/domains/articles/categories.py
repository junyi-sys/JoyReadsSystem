"""Detect topic category based on content and keywords."""

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "天文": ["太阳", "月亮", "星星", "地球", "行星", "宇宙", "黑洞", "银河", "太空", "彗星", "流星", "日食", "月食"],
    "生物": ["动物", "植物", "细胞", "基因", "进化", "恐龙", "海洋", "森林", "昆虫", "鸟类", "鱼类", "微生物"],
    "物理": ["力", "光", "电", "磁", "声音", "热", "能量", "原子", "分子", "重力", "速度", "运动"],
    "化学": ["元素", "反应", "分子", "原子", "燃烧", "溶解", "固体", "液体", "气体", "酸性", "碱性"],
    "地理": ["山", "河", "海", "气候", "地震", "火山", "大陆", "冰川", "沙漠", "雨林", "岛屿"],
    "历史": ["古代", "朝代", "皇帝", "战争", "文明", "发明", "考古", "遗址", "传统", "文化"],
    "人体": ["身体", "大脑", "心脏", "血液", "骨骼", "肌肉", "消化", "呼吸", "感官", "免疫"],
    "科技": ["电脑", "手机", "互联网", "AI", "机器人", "火箭", "卫星", "发明", "编程", "数据"],
}

TOPIC_CATEGORIES = list(CATEGORY_KEYWORDS.keys()) + ["其他"]

CATEGORY_ICONS: dict[str, str] = {
    "天文": "🌌", "生物": "🌿", "物理": "⚛️", "化学": "🧪",
    "地理": "🌍", "历史": "📜", "人体": "🧬", "科技": "🚀",
    "其他": "📌", "综合": "📌",
}

CATEGORY_COLORS: dict[str, str] = {
    "天文": "#722ed1", "生物": "#52c41a", "物理": "#1677ff", "化学": "#fa8c16",
    "地理": "#13c2c2", "历史": "#eb2f96", "人体": "#f5222d", "科技": "#2f54eb",
    "其他": "#8c8c8c", "综合": "#8c8c8c",
}


def detect_category(topic: str, content: str = "") -> str:
    text = topic + content[:200] if content else topic
    scores: dict[str, int] = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[cat] = score
    if not scores:
        return "综合"
    return max(scores, key=scores.get)
