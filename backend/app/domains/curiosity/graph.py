"""LangGraph state machine for curiosity series mode."""
import logging
from typing import TypedDict, Literal
from datetime import date

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

logger = logging.getLogger(__name__)


class CuriosityState(TypedDict, total=False):
    event_id: int | None
    student_id: int
    raw_text: str
    tags: list[str]
    mode: str
    socratic_mode: bool
    base_cognition: int
    effective_cognition: int
    series_id: int | None
    chapter_titles: list[dict]
    current_chapter: int
    user_question: str
    follow_up_question: str
    child_response: str
    article_id: int | None
    article_content: str
    paragraphs: list
    error: str
    done: bool


def _make_db():
    from ...database import SessionLocal
    return SessionLocal()


def node_load_event(state: CuriosityState, _db_factory) -> CuriosityState:
    from ...models import CuriosityEvent, Student
    db = _db_factory()
    try:
        e = db.query(CuriosityEvent).filter(
            CuriosityEvent.id == state.get("event_id"),
        ).first()
        if not e:
            return {"error": "事件不存在", "done": True}

        student = db.query(Student).filter(Student.id == state.get("student_id", 1)).first()
        base_cog = student.cognition_level if student else 1
        raw = e.raw_text or ""
        tags = e.tags_json or []

        from ...config import settings as cfg
        effective_cog = base_cog
        if any(kw in raw for kw in cfg.ADVANCED_KEYWORDS):
            effective_cog = min(base_cog + 1, cfg.COGNITION_MAX_LEVEL)

        return {
            "event_id": e.id,
            "raw_text": raw,
            "tags": tags,
            "base_cognition": base_cog,
            "effective_cognition": effective_cog,
            "student_id": state.get("student_id", 1),
            "current_chapter": state.get("current_chapter", 0),
            "chapter_titles": state.get("chapter_titles", []),
            "series_id": state.get("series_id"),
            "socratic_mode": state.get("socratic_mode", False),
            "child_response": state.get("child_response", ""),
        }
    finally:
        db.close()


def node_generate_one_shot(state: CuriosityState, _db_factory) -> CuriosityState:
    from ...models import DailyArticle, DailyCharacter, CuriosityEvent
    from ...domains.articles.generator import extract_characters_from_text

    db = _db_factory()
    try:
        topic = state["raw_text"]
        student_id = state["student_id"]
        chars = extract_characters_from_text(topic)

        from ...ai.factory import create_llm_provider
        from ...config import settings as cfg
        llm = create_llm_provider(cfg)

        ctx = _build_student_context(db, student_id)
        name = ctx["name"]

        # Dynamic cognition
        effective_cog = state.get("effective_cognition", 0)
        if ctx["concepts"]:
            effective_cog = min(effective_cog + 2, cfg.COGNITION_MAX_LEVEL)

        cog_guide = cfg.COGNITION_PROMPTS.get(
            min(effective_cog, cfg.COGNITION_MAX_LEVEL),
            cfg.COGNITION_PROMPTS[0],
        )

        # Build context
        context_parts = []
        if ctx["theories"]:
            theory_refs = "；".join([f"{name}提出过「{t['title']}」：{t['content'][:80]}" for t in ctx["theories"][:3]])
            context_parts.append(f"【{name}的理论库】{theory_refs}")
        if ctx["concepts"]:
            context_parts.append(f"【{name}已掌握的概念】{'、'.join(ctx['concepts'])}。不要用幼儿比喻解释这些概念。")
        ctx_block = "\n".join(context_parts) if context_parts else ""

        import asyncio
        result = asyncio.run(llm.generate(
            f"{ctx_block}\n\n{name}问了一个问题：{topic}\n\n要求：{cog_guide}\n250-350字。如果{name}之前有相关理论，一定要引用。只输出正文。",
            system=f"你是{name}的学伴。用匹配{name}能力的语言回答。如果{name}有相关理论，一定要在回答中认真引用。绝不用幼儿比喻糊弄一个懂高级概念的孩子。",
            temperature=0.7, max_tokens=1500,
        ))

        content = result.content
        today = date.today()
        from ...domains.articles.categories import detect_category
        a = DailyArticle(student_id=student_id, record_date=today, topic=topic,
                         content=content, character_count=len(content),
                         source="ai", category="answer",
                         topic_category=detect_category(topic, content))
        db.add(a)
        db.commit()
        db.refresh(a)

        event = db.query(CuriosityEvent).filter(CuriosityEvent.id == state["event_id"]).first()
        if event:
            event.is_answered = True
            event.linked_article_id = a.id
            db.commit()

        today_chars = set(r[0] for r in db.query(DailyCharacter.character)
            .filter(DailyCharacter.record_date == today, DailyCharacter.student_id == student_id).all())
        for ch in chars:
            if ch not in today_chars:
                db.add(DailyCharacter(student_id=student_id, record_date=today, character=ch, category="chinese"))
        db.commit()

        from ...shared.pinyin import annotate_text
        return {"article_id": a.id, "article_content": content,
                "paragraphs": annotate_text(content).get("paragraphs", []), "done": True}
    except Exception as e:
        logger.error(f"node_generate_one_shot: {e}")
        return {"error": str(e), "done": True}
    finally:
        db.close()


def _build_student_context(db, student_id: int) -> dict:
    """Build rich context about the student for prompt injection."""
    from ...models import Student, Theory, AdvancedConcept
    ctx = {"name": "小朋友", "theories": [], "concepts": [], "theory_count": 0}

    student = db.query(Student).filter(Student.id == student_id).first()
    if student:
        ctx["name"] = student.name

    theories = db.query(Theory).filter(
        Theory.student_id == student_id,
    ).order_by(Theory.created_at.desc()).limit(5).all()
    ctx["theories"] = [{"title": t.title, "content": t.content} for t in theories]
    ctx["theory_count"] = len(theories)

    concepts = db.query(AdvancedConcept).filter(
        AdvancedConcept.student_id == student_id,
    ).all()
    ctx["concepts"] = [c.concept for c in concepts]

    return ctx


def node_socratic_question(state: CuriosityState, _db_factory) -> CuriosityState:
    """Generate a Socratic follow-up question instead of an answer."""
    from ...models import CuriosityEvent
    db = _db_factory()
    try:
        topic = state["raw_text"]
        event_id = state.get("event_id")
        student_id = state.get("student_id", 1)

        from ...config import settings as cfg
        import httpx
        from openai import OpenAI
        import asyncio

        ctx = _build_student_context(db, student_id)
        name = ctx["name"]

        # Dynamic cognition: if child has advanced concepts, bump level
        effective_cog = state.get("effective_cognition", 0)
        if ctx["concepts"] and effective_cog < 4:
            effective_cog = min(effective_cog + 2, cfg.COGNITION_MAX_LEVEL)

        cog_label = cfg.COGNITION_LEVEL_LABELS.get(effective_cog, "儿童")

        # Build context preamble
        context_parts = [f"{name}问了一个问题：\"{topic}\""]
        if ctx["theories"]:
            theory_list = "；".join([f"「{t['title']}」：{t['content'][:60]}" for t in ctx["theories"][:3]])
            context_parts.append(f"{name}之前提出过这些理论：{theory_list}")
        if ctx["concepts"]:
            context_parts.append(f"{name}已经掌握了这些高级概念：{'、'.join(ctx['concepts'])}。请不要再把他当小孩，用匹配这些概念的水平提问。")

        full_context = "\n".join(context_parts)

        client = OpenAI(api_key=cfg.DEEPSEEK_API_KEY, base_url=cfg.DEEPSEEK_BASE_URL,
                        http_client=httpx.Client(timeout=30.0))

        prompt = f"""{full_context}

你是{name}的苏格拉底式学伴。不要直接给答案。基于{name}已有的理论和知识水平，提出一个能推动他思考更深的问题。
问题应该：
1. 匹配{name}的认知水平（他懂{ctx['concepts'][0] if ctx['concepts'] else '基础'}这个概念）
2. 如果能关联他之前的理论，一定要提到
3. 像一个朋友聊天，不是一个老师在出题
4. 用\"你\"称呼{name}

只输出一个问题，不要其他内容。"""

        resp = asyncio.run(asyncio.to_thread(
            lambda: client.chat.completions.create(
                model=cfg.DEEPSEEK_MODEL,
                messages=[{"role": "system", "content": f"你是{name}的学伴。你了解他的知识水平，用匹配他能力的语言对话。绝不把他当小孩糊弄。"},
                          {"role": "user", "content": prompt}],
                temperature=0.8, max_tokens=200,
            )
        ))
        follow_up = resp.choices[0].message.content.strip()

        event = db.query(CuriosityEvent).filter(CuriosityEvent.id == event_id).first()
        if event:
            event.socratic_mode = True
            event.follow_up_question = follow_up
            db.commit()

        return {"follow_up_question": follow_up, "done": True}
    except Exception as e:
        logger.error(f"node_socratic_question: {e}")
        return {"error": str(e), "done": True}
    finally:
        db.close()


def node_generate_socratic_answer(state: CuriosityState, _db_factory) -> CuriosityState:
    """Generate an answer that incorporates the child's own theory, referencing their name and past ideas."""
    from ...models import DailyArticle, DailyCharacter, CuriosityEvent, Theory
    from ...domains.articles.generator import extract_characters_from_text

    db = _db_factory()
    try:
        topic = state["raw_text"]
        student_id = state["student_id"]
        child_response = state.get("child_response", "")
        event_id = state.get("event_id")

        from ...config import settings as cfg
        import httpx
        from openai import OpenAI
        import asyncio

        ctx = _build_student_context(db, student_id)
        name = ctx["name"]

        # Dynamic cognition override based on advanced concepts
        effective_cog = state.get("effective_cognition", 0)
        if ctx["concepts"]:
            effective_cog = min(effective_cog + 2, cfg.COGNITION_MAX_LEVEL)
        cog_label = cfg.COGNITION_LEVEL_LABELS.get(effective_cog, "儿童")

        client = OpenAI(api_key=cfg.DEEPSEEK_API_KEY, base_url=cfg.DEEPSEEK_BASE_URL,
                        http_client=httpx.Client(timeout=60.0))

        # Build rich context
        context_parts = []
        if ctx["theories"]:
            theory_refs = "；".join([f"{name}提出过「{t['title']}」：{t['content'][:80]}" for t in ctx["theories"][:3]])
            context_parts.append(f"【{name}的理论库】{theory_refs}")
        if ctx["concepts"]:
            context_parts.append(f"【{name}已掌握的概念】{'、'.join(ctx['concepts'])}。不要用幼儿比喻解释这些概念。")

        context_block = "\n".join(context_parts) if context_parts else ""

        prompt = f"""{context_block}

{name}问了一个问题："{topic}"
{name}对这个问题的想法是："{child_response}"

请写一篇回答，必须遵守：
1. 开头引用{name}的想法——"根据{name}的想法，..."
2. 如果{name}之前有相关理论，一定要提到——"{name}你之前说过...，这和现在的问题有关联"
3. 在{name}想法的基础上扩展和深化，把他的想法当作"理论"来认真对待
4. 语言深度匹配他已有的概念水平，绝不用幼儿比喻糊弄
5. 250-350字
6. 结尾用一个更深的问题激发他继续想

只输出正文。"""

        resp = asyncio.run(asyncio.to_thread(
            lambda: client.chat.completions.create(
                model=cfg.DEEPSEEK_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7, max_tokens=1500,
            )
        ))
        content = resp.choices[0].message.content.strip()

        from ...domains.articles.categories import detect_category
        today = date.today()
        article = DailyArticle(
            student_id=student_id, record_date=today, topic=topic,
            content=content, character_count=len(content),
            source="ai", category="answer",
            topic_category=detect_category(topic, content),
        )
        db.add(article)
        db.flush()  # flush to get article.id, don't commit yet

        # Update curiosity event
        event = db.query(CuriosityEvent).filter(CuriosityEvent.id == event_id).first()
        if event:
            event.is_answered = True
            event.linked_article_id = article.id
            event.child_response = child_response

        # Generate a meaningful theory title (like a "law")
        theory_count = ctx["theory_count"]
        theory_num = theory_count + 1
        try:
            title_resp = asyncio.run(asyncio.to_thread(
                lambda: client.chat.completions.create(
                    model=cfg.DEEPSEEK_MODEL,
                    messages=[{"role": "user", "content": f"根据这段想法，生成一个简短有力的理论名称（5-12字），像科学定律的名字：\n\n想法：{child_response}\n\n只输出名称，不要引号。"}],
                    temperature=0.7, max_tokens=30,
                )
            ))
            theory_title = title_resp.choices[0].message.content.strip()
            if len(theory_title) > 20:
                theory_title = f"{name}第{theory_num}理论：{child_response[:15]}"
        except Exception:
            theory_title = f"{name}第{theory_num}理论：{child_response[:20]}"

        theory = Theory(
            student_id=student_id,
            title=theory_title,
            content=child_response,
            linked_curiosity_event_id=event_id,
            linked_article_id=article.id,
        )
        db.add(theory)
        db.flush()  # flush to get theory.id

        if event:
            event.theory_id = theory.id

        chars = extract_characters_from_text(topic)
        today_chars = set(r[0] for r in db.query(DailyCharacter.character)
            .filter(DailyCharacter.record_date == today, DailyCharacter.student_id == student_id).all())
        for ch in chars:
            if ch not in today_chars:
                db.add(DailyCharacter(student_id=student_id, record_date=today, character=ch, category="chinese"))

        # Single commit: article + event + theory + characters all-or-nothing
        db.commit()

        from ...shared.pinyin import annotate_text
        return {
            "article_id": article.id, "article_content": content,
            "paragraphs": annotate_text(content).get("paragraphs", []),
            "theory_id": theory.id, "done": True,
        }
    except Exception as e:
        logger.error(f"node_generate_socratic_answer: {e}")
        return {"error": str(e), "done": True}
    finally:
        db.close()


def node_decompose_topic(state: CuriosityState, _db_factory) -> CuriosityState:
    topic = state["raw_text"]
    try:
        import httpx
        from openai import OpenAI
        from ...config import settings as cfg
        import json, asyncio

        client = OpenAI(api_key=cfg.DEEPSEEK_API_KEY, base_url=cfg.DEEPSEEK_BASE_URL,
                        http_client=httpx.Client(timeout=30.0))
        resp = asyncio.run(asyncio.to_thread(
            lambda: client.chat.completions.create(
                model=cfg.DEEPSEEK_MODEL,
                messages=[{"role": "user", "content": f"把「{topic}」拆解成3-5个小章节，适合{cfg.COGNITION_LEVEL_LABELS.get(state.get('effective_cognition', 0), '儿童')}孩子分次阅读。每章250-300字。用JSON返回：[{{\"ch\":1,\"title\":\"标题\",\"summary\":\"一句话概括\"}}]"}],
                temperature=0.7, max_tokens=500,
            )
        ))
        raw = resp.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        chapters = json.loads(raw)

        if not isinstance(chapters, list) or len(chapters) == 0:
            raise ValueError("Empty chapter list")

        for ch in chapters:
            if not isinstance(ch, dict) or "title" not in ch:
                raise ValueError(f"Invalid chapter format: {ch}")

        return {"chapter_titles": chapters, "current_chapter": 0}
    except Exception as e:
        logger.error(f"node_decompose_topic: {e}, raw response: {raw if 'raw' in dir() else 'N/A'}")
        return {
            "chapter_titles": [
                {"ch": 1, "title": f"什么是{topic[:10]}？", "summary": "基本概念"},
                {"ch": 2, "title": f"{topic[:10]}是怎么形成的？", "summary": "深入原理"},
                {"ch": 3, "title": f"我们能看见{topic[:10]}吗？", "summary": "观察方法"},
            ],
            "current_chapter": 0,
        }


def node_generate_chapter(state: CuriosityState, _db_factory) -> CuriosityState:
    from ...models import ArticleSeries, DailyArticle, CuriosityEvent
    from ...config import settings as cfg

    db = _db_factory()
    try:
        series_id = state.get("series_id")
        chapter_idx = state.get("current_chapter", 0)
        chapters = state.get("chapter_titles", [])
        student_id = state.get("student_id", 1)

        if chapter_idx >= len(chapters):
            return {"done": True}

        ch = chapters[chapter_idx]
        ch_title = ch.get("title", "")
        ch_summary = ch.get("summary", "")

        import httpx
        from openai import OpenAI
        import asyncio

        ctx = _build_student_context(db, student_id)
        name = ctx["name"]

        # Dynamic cognition
        effective_cog = state.get("effective_cognition", 0)
        if ctx["concepts"]:
            effective_cog = min(effective_cog + 2, cfg.COGNITION_MAX_LEVEL)

        cog_guide = cfg.COGNITION_PROMPTS.get(
            min(effective_cog, cfg.COGNITION_MAX_LEVEL),
            cfg.COGNITION_PROMPTS[0],
        )

        user_q = state.get('user_question', '')
        q_hint = f'\n{name}阅读后提出了疑问："{user_q}"\n请在写作中自然地回答或关联这个问题。' if user_q else ''

        # Build context
        context_parts = []
        if ctx["concepts"]:
            context_parts.append(f"【{name}已掌握的概念】{'、'.join(ctx['concepts'])}。绝不用幼儿比喻解释这些概念。")
        if ctx["theories"]:
            theory_refs = "；".join([f"{name}提出过「{t['title']}」" for t in ctx["theories"][:3]])
            context_parts.append(f"【{name}的理论库】{theory_refs}。如果相关，在文中引用。")
        ctx_block = "\n".join(context_parts)

        prompt = f"""{ctx_block}

为{name}写一章科普文章。
主题系列：{state.get('raw_text', '')}
本章标题：{ch_title}
本章概要：{ch_summary}{q_hint}

注意：上一章{name}可能已经展示了超出预期的理解力。本章的深度要匹配他实际的知识水平。

要求：1. 250-300字 2. {cog_guide} 3. 如果{name}的理论或概念和本章相关，一定要引用 4. 结尾留悬念 5. 只输出本章内容"""

        resp = asyncio.run(asyncio.to_thread(
            lambda: client.chat.completions.create(
                model=cfg.DEEPSEEK_MODEL,
                messages=[{"role": "system", "content": f"你是{name}的科普作家。每章250-300字。结尾有悬念。你的难度要匹配{name}的知识水平——他可能懂得比你预期的多，不要低估他。"},
                          {"role": "user", "content": prompt}],
                temperature=0.7, max_tokens=800,
            )
        ))
        content = resp.choices[0].message.content.strip()

        today = date.today()
        from ...domains.articles.categories import detect_category
        article = DailyArticle(
            student_id=state.get("student_id", 1), record_date=today,
            topic=ch_title, content=content, character_count=len(content),
            source="ai", category="answer",
            series_id=series_id, chapter_number=chapter_idx + 1,
            topic_category=detect_category(ch_title, content),
        )
        db.add(article)
        db.commit()
        db.refresh(article)

        if chapter_idx == 0 and state.get("event_id"):
            event = db.query(CuriosityEvent).filter(CuriosityEvent.id == state["event_id"]).first()
            if event:
                event.is_answered = True
                event.linked_article_id = article.id

        series = db.query(ArticleSeries).filter(ArticleSeries.id == series_id).first()
        if series:
            series.current_chapter = chapter_idx + 1
        db.commit()

        from ...shared.pinyin import annotate_text
        return {
            "article_id": article.id,
            "article_content": content,
            "paragraphs": annotate_text(content).get("paragraphs", []),
            "current_chapter": chapter_idx + 1,
            "done": True,
        }
    except Exception as e:
        logger.error(f"node_generate_chapter: {e}")
        return {"error": str(e), "done": True}
    finally:
        db.close()


def node_complete_series(state: CuriosityState, _db_factory) -> CuriosityState:
    from ...models import ArticleSeries as AS
    db = _db_factory()
    try:
        series_id = state.get("series_id")
        series = db.query(AS).filter(AS.id == series_id).first()
        if series:
            series.status = "completed"
            db.commit()
        return {"done": True}
    finally:
        db.close()


def route_by_mode(state: CuriosityState) -> Literal["node_socratic_question", "node_generate_one_shot", "node_generate_socratic_answer", "node_decompose_topic", "node_generate_chapter"]:
    mode = state.get("mode", "one_shot")
    if mode == "series":
        titles = state.get("chapter_titles", [])
        if titles and len(titles) > 0:
            return "node_generate_chapter"
        return "node_decompose_topic"
    if state.get("socratic_mode"):
        if state.get("child_response"):
            return "node_generate_socratic_answer"
        return "node_socratic_question"
    return "node_generate_one_shot"


def route_after_chapter(state: CuriosityState) -> Literal["node_complete_series", "__end__"]:
    chapters = state.get("chapter_titles", [])
    current = state.get("current_chapter", 0)
    if current >= len(chapters):
        return "node_complete_series"
    return "__end__"


_curiosity_graph = None


def get_curiosity_graph():
    global _curiosity_graph
    if _curiosity_graph is not None:
        return _curiosity_graph

    builder = StateGraph(CuriosityState)
    builder.add_node("node_load_event", lambda s: node_load_event(s, _make_db))
    builder.add_node("node_socratic_question", lambda s: node_socratic_question(s, _make_db))
    builder.add_node("node_generate_socratic_answer", lambda s: node_generate_socratic_answer(s, _make_db))
    builder.add_node("node_generate_one_shot", lambda s: node_generate_one_shot(s, _make_db))
    builder.add_node("node_decompose_topic", lambda s: node_decompose_topic(s, _make_db))
    builder.add_node("node_generate_chapter", lambda s: node_generate_chapter(s, _make_db))
    builder.add_node("node_complete_series", lambda s: node_complete_series(s, _make_db))

    builder.add_edge(START, "node_load_event")
    builder.add_conditional_edges("node_load_event", route_by_mode)
    builder.add_edge("node_socratic_question", END)
    builder.add_edge("node_generate_socratic_answer", END)
    builder.add_edge("node_generate_one_shot", END)
    builder.add_edge("node_decompose_topic", "node_generate_chapter")
    builder.add_conditional_edges("node_generate_chapter", route_after_chapter)
    builder.add_edge("node_complete_series", END)

    checkpointer = MemorySaver()
    _curiosity_graph = builder.compile(checkpointer=checkpointer)
    return _curiosity_graph
