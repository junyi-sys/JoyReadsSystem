from pypinyin import pinyin, Style


def annotate_text(text: str) -> dict:
    """Annotate text with pinyin, returning paragraphs with token-level pinyin."""
    paragraphs = text.strip().split("\n")
    result = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        tokens = []
        for ch in para:
            if "一" <= ch <= "鿿":
                py = pinyin(ch, style=Style.TONE)[0][0]
                tokens.append({"char": ch, "pinyin": py})
            else:
                tokens.append({"char": ch, "pinyin": ""})
        result.append({"text": para, "tokens": tokens})
    return {"paragraphs": result}


def annotate_article(content: str) -> dict:
    """Alias for annotate_text, used by routers."""
    return annotate_text(content)
