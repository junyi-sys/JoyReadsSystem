# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

俊宜识字 v2 — AI 驱动的儿童中文识字应用。生成适配认知水平的短文，拼音标注、语音朗读、生字分区管理和好奇心问答引擎。

## 常用命令

```bash
# 后端（Python 3.12）
cd backend
source .venv/Scripts/activate     # 激活虚拟环境
pip install -r requirements.txt   # 安装依赖（首次）
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload   # 启动后端

# 前端
cd frontend
npm install                       # 安装依赖（首次）
npm run dev                       # Vite 开发服务器 :3001
npm run build                     # 生产构建 (tsc && vite build)
```

Vite 代理配置：`/api` 和 `/audio` 转发到 `http://127.0.0.1:8002`。开发时前后端同时运行即可。

**首次设置**：创建 MySQL 数据库 → 复制 `backend/.env.example` 为 `backend/.env` 并填写密钥 → 创建并激活虚拟环境 → `pip install -r requirements.txt` → `npm install`。

## 技术栈

- **后端**: FastAPI + SQLAlchemy ORM + MySQL (PyMySQL)
- **前端**: React 18 + TypeScript + Vite + Ant Design 5 + Zustand + Framer Motion
- **AI**: DeepSeek (LLM), Edge-TTS (语音), CogView/GLM (图片)
- **编排**: LangGraph StateGraph（好奇心系列模式的多步任务）

## 后端架构

```
backend/app/
├── main.py          FastAPI 入口, CORS, router 注册, startup 建表+默认学生
├── config.py        pydantic-settings, 所有环境变量集中定义
├── database.py      SQLAlchemy engine/session/get_db/init_db
├── di.py            线程安全懒加载单例容器 (LLM/TTS/Image provider)
├── models/          ORM 模型 (Base → 各表模型, TimestampMixin)
├── domains/         领域模块 (router → service → repository 模式)
│   ├── articles/    文章生成/历史/系列/已读状态
│   ├── characters/  生字四区 + 统计 + 交互追踪 + 自动晋升引擎
│   ├── curiosity/   好奇心问答 (含 LangGraph 状态图)
│   ├── students/    学生列表（只读）
│   └── tts/         语音合成
├── ai/              AI 抽象接口 (LLMProvider/TTSProvider/ImageProvider) 及实现
├── schemas/         跨域共享 Pydantic 模型 (PaginatedRequest, MessageResponse)
└── shared/          拼音标注、异常类、中间件、ensure_student
```

### 关键模式

- **多学生架构**: 通过 `X-Student-ID` 请求头区分学生，前端 Axios 拦截器自动注入（从 localStorage 读取）。后端 `get_current_student_id` 验证学生是否存在且活跃，否则回退到第一个活跃学生，再无则回退到 1。`main.py` 启动时若 Student 表为空会自动创建默认学生（id=1）。
- **ensure_student**: `shared/ensure_student.py` 在 repository 层被调用，当 student_id 不存在时自动创建默认学生记录。使用 `db.flush()` 而非 `commit()`，事务与调用者绑定。

### 生字四区 + 自动引擎

四区统一为一张 `character` 表，`zone` 字段区分 target/scout/ally/lost。另有 `character_interaction`（点读记录）和 `character_zone_log`（区变更历史）。

**三个自动引擎**：
- **点读降级** — PinyinWord 每次点击上报 `POST /api/characters/interaction`，累计 tap_count ≥ 3 且 zone=ally → 自动降回 target
- **自然习得晋升** — 文章标记"已读"时触发：scout 区字在 ≥3 篇已读文章中未被点读 → 自动晋升 ally；ally 区字被点读 → 降回 target
- **文章生成联动** — 生成文章时注入字库上下文到 LLM prompt（已掌握的字放心用、学习中的字多重复、困难字重点复习）

### 其他模式

- **认知分级**: `config.py` 中 `COGNITION_MAX_LEVEL`(1-3) 控制文章难度，`ADVANCED_KEYWORDS` 包含高级关键词（因为/所以/原子/基因等），触发时临时提升认知等级。
- **AI Provider 抽象**: `ai/base.py` 定义接口，`factory.py` 根据 `LLM_PROVIDER` / `IMAGE_PROVIDER` / `TTS_PROVIDER` 配置创建实例。`di.py` 提供线程安全的双检锁单例。
- **异常处理**: `shared/exceptions.py` 定义 `AppError`（基类）、`NotFoundError`(404)、`AIError`(502)，`main.py` 注册全局异常处理器统一返回 JSON。
- **LangGraph 好奇心引擎**: `curiosity/graph.py` — one_shot 模式直接生成回答；series 模式先分解话题为章节 (`node_decompose_topic`)，再逐章生成 (`node_generate_chapter`)，用 MemorySaver 做内存检查点。注意：LangGraph 节点中调用 `asyncio.run()` 包装异步 LLM 调用，不能在已运行的事件循环中执行 graph。

## 前端架构

```
frontend/src/
├── main.tsx           入口: React.StrictMode + Antd ConfigProvider(主题+zhCN) + BrowserRouter
├── App.tsx            路由定义 (AppShell 布局路由 + /series/:seriesId 独立页)
├── pages/             页面组件 (HomePage, ArticleHistoryPage, CuriosityPage,
│                       CharacterZonesPage, StatsPage, SeriesReaderPage)
├── components/
│   ├── layout/        AppShell(侧边栏+顶栏+内容区), StudentSwitcher
│   ├── reader/        ArticleReader, PinyinWord, audioCache (点读缓存+预加载)
│   ├── character/     CharacterCard(含tap_count显示), ZoneBoard (四区看板)
│   ├── curiosity/     CuriosityBubble, SeriesProgress
│   ├── game/          ReadingBuddy, StreakBadge, AchievementModal
│   └── ui/            CartoonButton/Card/Tag 通用组件
├── store/             Zustand: useAppStore(UI状态), useStudentStore(当前学生)
├── services/api.ts    Axios 实例 + 所有 API 封装
├── types/index.ts     TypeScript 类型定义
├── theme/             global.css, tokens.ts (浅绿+蓝配色), animations.ts
└── hooks/             useAudio (TTS 播放)
```

### 关键模式

- **主题**: 浅绿主色 `#6DBF6E` + 天蓝辅色 `#4DABF7` + 薄荷绿白背景 `#F0F7F4`。Ant Design 主题通过 `ConfigProvider theme.token` 注入，`tokens.ts` 和 `global.css` 同步维护。
- **点读发音**: 混合方案。文章加载时后台预加载 Edge-TTS 音频（3字一批，存入 `audioCache` Map）。点击时优先播缓存的高音质 Edge-TTS，未缓存则用浏览器 SpeechSynthesis（Yaoyao 童声优先，0.7 倍速）即时兜底。
- **学生上下文**: `useStudentStore` 管理当前学生和全部学生列表，切换时更新 localStorage。API 拦截器读取 localStorage 设置 `X-Student-ID` 头。
- **API 封装**: 每个领域一个对象 (articlesApi, curiosityApi, charactersApi 等)，调用 `api.get/post`。超时 120s（AI 生成耗时较长）。

## 数据库

- **数据库**: MySQL `junyi_word_v2` (生产) / `junyi_word_dev` (开发)
- **建表**: 启动时 `init_db()` 调用 `Base.metadata.create_all()`
- **迁移脚本**: `sql/migration_character_unify.sql` — 四区表合并到单表的迁移

## 环境变量

后端 `.env` 配置项（模板见 `backend/.env.example`）:

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | MySQL 连接 | localhost:3306 |
| `LLM_PROVIDER` | 大模型提供方 | deepseek |
| `IMAGE_PROVIDER` | 图片生成提供方 | cogview |
| `TTS_PROVIDER` | 语音合成提供方 | edgetts |
| `DEEPSEEK_API_KEY/BASE_URL/MODEL` | DeepSeek 配置 | deepseek-chat |
| `GLM_API_KEY` | 智谱 API Key | — |
| `GLM_IMAGE_MODEL` | 智谱图片模型 | cogview-3-plus |
| `COGNITION_MAX_LEVEL` | 认知等级上限 (1-3) | 3 |

## 注意事项

- LLM 生成 API 超时 120 秒（前端），LangGraph 内部节点超时 30-60 秒，AI 响应可能较慢
- 后端端口 8002；如改端口需同步修改 `frontend/vite.config.ts` 代理目标
- 生字拼音标注仅处理 CJK 统一汉字区间 `[一-鿿]`
- `get_current_student_id` 自己打开数据库会话（非 FastAPI 依赖注入），注意调用链中不要额外开启事务
- 没有测试框架和 lint 工具 —— 建议从 `pytest` + `ruff`（后端）和 `eslint` + `prettier`（前端）开始
- 新增领域模块：创建 `router.py` / `service.py` / `repository.py` → `main.py` 中 `include_router` → 前端在 `services/api.ts` 添加 API 对象
- 好奇心模块 (curiosity/) 和 TTS 模块 (tts/) 与字库系统独立，改动字库不影响它们
- edge-tts 需 ≥7.2.8 版本（旧版令牌过期导致 403）
