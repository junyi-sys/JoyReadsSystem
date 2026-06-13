# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

俊宜阅读 V2.0.0 — AI 驱动的儿童中文阅读应用。好奇心种子驱动的精读计划、主问题+子问题链探究式精读、生字四区管理、知识图谱、语音输入/输出。

## 常用命令

### 一键启动

```bash
bash scripts/start-dev.sh           # 开发环境（前端 :3002, 后端 :8002, DB=junyi_reading_dev）
bash scripts/start-prod.sh          # 正式环境（前端 :3001, 后端 :8001, DB=junyi_reading）
```

### 手动启动

```bash
# 后端（Python 3.12）
cd backend
source .venv/Scripts/activate
pip install -r requirements.txt     # 安装依赖（首次）
APP_ENV=development python run.py   # 开发环境 :8002
APP_ENV=production python run.py    # 正式环境 :8001

# 前端
cd frontend
npm install                         # 安装依赖（首次）
npm run dev                         # 开发环境 :3002 (proxy → :8002)
npm run dev:prod                    # 正式环境 :3001 (proxy → :8001)
npm run build                       # 生产构建 (tsc && vite build, 用于 APK)
npm run preview                     # 预览构建产物
```

### Android (Capacitor)

```bash
cd frontend

# 打开 Android Studio
npx cap open android

# APK 构建（使用后端地址，不经过 Vite proxy）
npm run build:apk                  # tsc && vite build --mode apk
npx cap sync android               # 同步构建产物到 Android 项目
# 然后在 Android Studio 中生成 APK/AAB

# 或一步完成（构建 + 同步）
npm run build:apk:sync

# 浏览器预览构建（使用 Vite proxy /api）
npm run build                      # tsc && vite build（默认 mode=production）
npm run preview                    # 本地预览构建产物
```

#### 环境文件选择逻辑

| 命令 | 加载的 .env 文件 | VITE_API_BASE | 适用场景 |
|------|------------------|---------------|----------|
| `npm run dev:prod` | `.env.production` | `/api` (走 Vite proxy) | 浏览器正式环境预览 |
| `npm run build` | `.env.production` | `/api` (走 Vite proxy) | 浏览器预览构建产物 |
| `npm run build:apk` | `.env.apk` (+ `.env.apk.local`) | `http://IP:8001/api` | APK 构建 |

> **注意：** APK 构建时 `VITE_API_BASE` 必须指向 Android 设备可达的地址。
>
> 默认值为 `http://192.168.1.4:8001/api`。如需修改，创建
> `frontend/.env.apk.local` 文件（已 gitignored）：
> ```env
> VITE_API_BASE=http://你的局域网IP:8001/api
> ```
>
> 不要编辑 `.env.production`——那是给浏览器预览用的，改了会影响本地工作。

### 环境隔离说明

| | 开发 (feature-dev) | 正式 (master) |
|---|---|---|
| 前端端口 | 3002 | 3001 |
| 后端端口 | 8002 | 8001 |
| 数据库 | junyi_reading_dev | junyi_reading |
| 启动命令 | `bash scripts/start-dev.sh` | `bash scripts/start-prod.sh` |
| APP_ENV 值 | development | production |

环境由 `APP_ENV` 环境变量控制。后端 `config.py` 先加载 `.env.{APP_ENV}` 再加载 `.env`（后者覆盖前者，存放密钥）。前端 Vite 按 mode 自动加载 `.env.development` 或 `.env.production`。

**首次设置**：创建 MySQL 数据库 `junyi_reading_dev`（开发）和 `junyi_reading`（正式）→ 复制 `backend/.env.example` 为 `backend/.env` 并填写密钥 → 创建并激活虚拟环境 → `pip install -r requirements.txt` → `npm install`。

## 技术栈

- **后端**: FastAPI + SQLAlchemy ORM + MySQL (PyMySQL)
- **前端**: React 18 + TypeScript + Vite + Ant Design 5 + Zustand + Framer Motion
- **移动端**: Capacitor 8 (Android 打包)
- **AI**: DeepSeek (LLM), Edge-TTS (语音), Faster-Whisper (语音识别), CogView/GLM (图片)
- **编排**: LangGraph StateGraph（好奇心系列模式的多步任务）

## 后端架构

```
backend/app/
├── main.py          FastAPI 入口, CORS, router 注册, startup 建表+默认学生
├── config.py        pydantic-settings, 环境变量 + 认知系统配置 (COGNITION_PROMPTS, ADVANCED_KEYWORDS)
├── database.py      SQLAlchemy engine/session/get_db/init_db (pool_size=10)
├── di.py            线程安全懒加载单例容器 (LLM/TTS/Image provider)
├── models/          ORM 模型 (Base → Student, DailyArticle, ArticleSeries,
│                       Character, CharacterInteraction, CharacterZoneLog,
│                       CuriosityEvent, Theory, ArticleReadStatus)
├── domains/         领域模块 (router → service → repository 模式)
│   ├── articles/    文章生成/历史/系列/已读状态 + 精读记录(reading-record)
│   │   └── generator.py  提取汉字 + 构建 LLM prompt（注入字库上下文）
│   ├── characters/  生字四区 + 统计(stats_router.py) + 交互追踪 + 自动晋升引擎
│   ├── curiosity/   好奇心问答 + 苏格拉底追问 (含 LangGraph 状态图 graph.py)
│   ├── plan/        精读计划 (V2.0 核心): 创建/周列表/start_day/complete_day
│   ├── seeds/       好奇心种子池: 自动收集/手动管理/种子生长
│   ├── knowledge/   知识图谱: 概念提取/深度追踪
│   ├── students/    学生列表 + 等级进度
│   ├── theory/      孩子的自建理论（与好奇心事件和文章关联）
│   ├── tts/         语音合成 (仅 router + service，无 repository)
│   ├── stt/         语音识别 (faster-whisper 本地模型，仅 router + service)
│   ├── parent/      家长控制台: 多学生概览/PIN验证
│   └── radar/       五维能力雷达图数据
├── ai/              AI 抽象接口 (LLMProvider/TTSProvider/ImageProvider) 及实现
├── schemas/         跨域共享 Pydantic 模型 (PaginatedRequest, MessageResponse)
└── shared/          拼音标注、异常类、middleware(get_current_student_id)、
                     ensure_student（自动创建缺失学生）
```

### 关键模式

- **多学生架构**: 通过 `X-Student-ID` 请求头区分学生，前端 Axios 拦截器自动注入（从 localStorage 读取）。后端 `get_current_student_id` 验证学生是否存在且活跃，否则回退到第一个活跃学生，再无则回退到 1。`main.py` 启动时若 Student 表为空会自动创建默认学生（id=1）。
- **ensure_student**: `shared/ensure_student.py` 在 repository 层被调用，当 student_id 不存在时自动创建默认学生记录。使用 `db.flush()` 而非 `commit()`，事务与调用者绑定。

### 生字四区 + 自动引擎

四区统一为一张 `character` 表，`zone` 字段区分 target/scout/ally/lost。另有 `character_interaction`（点读记录）和 `character_zone_log`（区变更历史）。

**三个自动引擎**：
- **点读降级** — PinyinWord 每次点击上报 `POST /api/characters/interaction`，累计 tap_count ≥ 3 且 zone=ally → 自动降回 target
- **自然习得晋升** — 文章标记"已读"时触发：scout 区字在 ≥3 篇已读文章中未被点读 → 自动晋升 ally；ally 区字被点读 → 降回 target
- **文章生成联动** — 生成文章时注入字库上下文到 LLM prompt（已掌握的字放心用、学习中的字多重复、困难字重点复习）。`ARTICLE_DENSITY_TIERS` 按已知字数自动匹配文章长度和生字密度，支持 `density`（每百字新字数）和 `reinforce`（每百字复习数）参数。主题分类（天文/生物/物理/化学/地理/历史/人体/科技）由 `categories.py` 自动检测并提供图标和颜色。

### 精读计划 + 好奇心种子 (V2.0 新增)

精读计划 (`plan/`) 是 V2.0 核心模块，提供结构化精读体验：

- **种子驱动话题来源**: `start_day` 优先从好奇心种子池 (curiosity_seed) 取 pending 问题作为精读话题，种子用完后 fallback 到 WEEKLY_THEMES 预设主题
- **主问题+子问题链**: LLM 一次生成完整教案 JSON (`lesson_json`)，包含 `main_question`（主问题）、`pre_reading`（导读背景）、`paragraphs[]`（分段/线索提示）、`sub_questions[]`（找线索→推因果→联生活）、`extension`（回到主问题）
- **四阶段精读流程**: 导读（展示问题清单）→ 读中探究（分段阅读+线索提示）→ 读后思考（子问题表单+参考答案对照）→ 回到主问题
- **种子状态机**: `pending → growing（start_day）→ converted（complete_day）`
- **精读记录**: `GET /api/articles/{id}/reading-record` 返回完整精读过程（主问题+子问题+答案+参考答案）
- **种子池**: `seeds/` 领域提供 `SeedRepository`，`PlanRepository.claim_pending_seed()` 原子领取种子
- **前端页面**: `PlanPage.tsx`（计划卡片+好奇心来源标记）、`ReadingSessionPage.tsx`（四阶段状态机+主问题固顶）

### 其他模式

- **认知分级**: 7 个等级（0-6，学前~六年级），`config.py` 中 `COGNITION_MAX_LEVEL`(0-6) 控制文章难度上限。每个等级有 `COGNITION_PROMPTS` 指导 LLM 生成。`LEVEL_THRESHOLDS` 定义升级所需文章数和识字量，达到阈值自动升级。`ADVANCED_KEYWORDS` 包含高级关键词（因为/所以/原理/原子/基因/宇宙等），当文章主题或生字触发这些词时临时提升认知等级，确保高级话题给出更深度的解释。
- **AI Provider 抽象**: `ai/base.py` 定义接口，`factory.py` 根据 `LLM_PROVIDER` / `IMAGE_PROVIDER` / `TTS_PROVIDER` 配置创建实例。`di.py` 提供线程安全的双检锁单例。
- **异常处理**: `shared/exceptions.py` 定义 `AppError`（基类）、`NotFoundError`(404)、`AIError`(502)，`main.py` 注册全局异常处理器统一返回 JSON。
- **LangGraph 好奇心引擎**: `curiosity/graph.py` — one_shot 模式直接生成回答；series 模式先分解话题为章节 (`node_decompose_topic`)，再逐章生成 (`node_generate_chapter`)，用 MemorySaver 做内存检查点。注意：LangGraph 节点中调用 `asyncio.run()` 包装异步 LLM 调用，不能在已运行的事件循环中执行 graph。
- **苏格拉底追问**: `curiosity/` 支持 `socratic_mode` — AI 不直接给答案，用引导性追问 (`follow_up_question`) 启发孩子思考。孩子回答后 (`child_response`) 生成更深入的解释。通过 `POST /curiosity/ask-socratic` 和 `POST /curiosity/socratic-answer` 交互。
- **理论追踪**: `theory/` 领域让孩子建立自己的理论 (`Theory` 模型，含 title/content，可关联 `curiosity_event` 或 `article`)。通过 `POST /theory` 创建，`GET /theory` 列出。

## 前端架构

```
frontend/src/
├── main.tsx           入口: React.StrictMode + Antd ConfigProvider(主题+zhCN) + BrowserRouter
├── App.tsx            路由定义 (AppShell 布局路由 + /series/:seriesId 独立页)
├── pages/             页面组件 (HomePage, ArticleHistoryPage, CuriosityPage,
│                       CharacterZonesPage, StatsPage, SeriesReaderPage,
│                       PlanPage, ReadingSessionPage, KnowledgeGraphPage,
│                       ParentDashboardPage)
├── components/
│   ├── layout/        AppShell(侧边栏+顶栏+内容区), StudentSwitcher, ParentGate
│   ├── reader/        ArticleReader, PinyinWord, audioCache (点读缓存+预加载)
│   ├── character/     CharacterCard(含tap_count显示), ZoneBoard (四区看板)
│   ├── curiosity/     CuriosityBubble, SeriesProgress, SeedPool
│   ├── game/          ReadingBuddy, StreakBadge, AchievementModal, LevelUpModal
│   ├── theory/        TheoryCard
│   └── ui/            CartoonButton/Card/Tag 通用组件, VoiceInputButton, RadarChart
├── store/             Zustand: useAppStore(UI状态), useStudentStore(当前学生)
├── services/api.ts    Axios 实例 + 所有 API 封装
├── types/index.ts     TypeScript 类型定义
├── theme/             global.css, tokens.ts (浅绿+蓝配色), animations.ts
└── hooks/             useAudio (TTS 播放), useVoiceInput (语音输入)
```

### 关键模式

- **主题**: 浅绿主色 `#6DBF6E` + 天蓝辅色 `#4DABF7` + 薄荷绿白背景 `#F0F7F4`。Ant Design 主题通过 `ConfigProvider theme.token` 注入，`tokens.ts` 和 `global.css` 同步维护。
- **点读发音**: 混合方案。文章加载时后台预加载 Edge-TTS 音频（3字一批，存入 `audioCache` Map）。点击时优先播缓存的高音质 Edge-TTS，未缓存则用浏览器 SpeechSynthesis（Yaoyao 童声优先，0.7 倍速）即时兜底。
- **语音输入**: `useVoiceInput` hook + `VoiceInputButton` 组件。前端用 MediaRecorder 录制音频（webm/opus），通过 `POST /stt/transcribe` 上传到后端 faster-whisper 转文字。后端用 ffmpeg 预处理非 WAV 格式（转 16kHz 单声道 PCM）。注意：不使用 Web Speech API（国内无法访问 Google 服务）。
- **学生上下文**: `useStudentStore` 管理当前学生和全部学生列表，切换时更新 localStorage。API 拦截器读取 localStorage 设置 `X-Student-ID` 头。
- **API 封装**: 每个领域一个对象 (articlesApi, curiosityApi, charactersApi 等)，调用 `api.get/post`。超时 120s（AI 生成耗时较长）。
- **Capacitor Android**: `capacitor.config.ts` 配置 `appId: com.junyi.reading`，`androidScheme: http`（开发时允许明文 HTTP 访问 dev server）。`npx cap sync android` 同步前端 build 产物到 `android/`。

## 数据库

- **数据库**: MySQL，开发用 `junyi_reading_dev`，正式用 `junyi_reading`（由 `.env.{APP_ENV}` 的 DB_NAME 决定）
- **建表**: 启动时 `init_db()` 调用 `Base.metadata.create_all()`，不依赖独立迁移脚本
- **schema 变更**: 直接修改 ORM 模型后重启即可，新增列会自动添加
- **迁移脚本**: `scripts/migrate_characters.py` — 从旧库 (4表) 迁移到统一 character 表。`sql/` 目录有对应的 DDL SQL

## 环境变量

配置分层（按加载优先级）：
1. `.env.{APP_ENV}` — 环境默认值（`.env.dev` 或 `.env.prod`，可提交 git）
2. `.env` — 用户实际密钥（gitignored，从 `.env.example` 复制）

| 变量 | 说明 | 开发默认值 | 正式默认值 |
|------|------|-----------|-----------|
| `APP_ENV` | 环境标识 | development | production |
| `APP_PORT` | 后端端口 | 8002 | 8001 |
| `DB_NAME` | 数据库名 | junyi_reading_dev | junyi_reading |
| `DB_HOST/PORT/USER/PASSWORD` | MySQL 连接 | localhost:3306/root/(空) | 同 |
| `LLM_PROVIDER` | 大模型提供方 | deepseek | deepseek |
| `IMAGE_PROVIDER` | 图片生成提供方 | cogview | cogview |
| `TTS_PROVIDER` | 语音合成提供方 | edgetts | edgetts |
| `DEEPSEEK_API_KEY/BASE_URL/MODEL` | DeepSeek 配置 | — | — |
| `GLM_API_KEY` | 智谱 API Key | — | — |
| `GLM_IMAGE_MODEL` | 智谱图片模型 | cogview-3-plus | cogview-3-plus |
| `STT_MODEL` | 语音识别模型大小 | base | base |
| `COGNITION_MAX_LEVEL` | 认知等级上限 (0-6) | 6 | 6 |

### 认知分级系统

`config.py` 中定义了三个认知等级的 prompt 策略：
- **Level 1** (幼儿园): 简单语言，比喻，日常例子，每个概念一句话
- **Level 2** (小学生): 简单因果关系，熟悉场景举例
- **Level 3** (小学高年级): 清晰准确，引入基础科学概念，鼓励思考

`ADVANCED_KEYWORDS` 列表（因为/所以/原理/分子/原子/基因/宇宙/进化/黑洞/量子等）会在文章生成时被检测：触发关键词时临时提升认知等级，确保高级话题用更深度的解释。

## 系统使用范例

以下 `curl` 示例演示核心 API 使用流程。所有请求需带 `X-Student-ID` 头（默认 `1`）。

### 文章生成与阅读

```bash
# 生成一篇指定主题的文章
curl -s -X POST http://localhost:8002/api/articles/generate \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"topic": "春天", "characters": ["花","草","风"], "min_chars": 100, "max_chars": 300}'

# 获取今日文章
curl -s http://localhost:8002/api/articles/today -H "X-Student-ID: 1"

# 获取一篇具体文章
curl -s http://localhost:8002/api/articles/1 -H "X-Student-ID: 1"

# 标记文章已读（触发自然习得晋升引擎）
curl -s -X POST http://localhost:8002/api/articles/1/read-status \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"status": "read", "read_count": 5, "total_count": 5}'

# 获取文章历史
curl -s "http://localhost:8002/api/articles/history?limit=20&offset=0" -H "X-Student-ID: 1"

# 查看文章系列
curl -s http://localhost:8002/api/articles/series/1 -H "X-Student-ID: 1"
```

### 生字四区管理

```bash
# 查看字库统计
curl -s http://localhost:8002/api/characters/stats -H "X-Student-ID: 1"

# 获取某一区的字（zone: target | scout | ally | lost）
curl -s http://localhost:8002/api/characters/zone/scout -H "X-Student-ID: 1"

# 添加生字到目标区
curl -s -X POST http://localhost:8002/api/characters/add \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"character": "叶", "zone": "target"}'

# 手动移动生字区域
curl -s -X POST http://localhost:8002/api/characters/move \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"character": "叶", "from_zone": "target", "to_zone": "scout"}'

# 点读交互上报（累计3次 ally 自动退回 target）
curl -s -X POST http://localhost:8002/api/characters/interaction \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"character": "花", "article_id": 1}'
```

### 好奇心问答

```bash
# 一次性问答
curl -s -X POST http://localhost:8002/api/curiosity/ask \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "为什么天空是蓝色的？", "mode": "one_shot"}'

# 开启系列问答（LangGraph 分解话题+逐章生成）
curl -s -X POST http://localhost:8002/api/curiosity/ask-series \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "太阳系有哪些行星？"}'

# 系列问答 — 继续下一章
curl -s -X POST http://localhost:8002/api/curiosity/series-next \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"event_id": 1, "want_next": true}'

# 获取问答事件列表
curl -s "http://localhost:8002/api/curiosity/events?limit=20" -H "X-Student-ID: 1"
```

### 语音相关

```bash
# 语音合成（返回 WAV）
curl -s -X POST http://localhost:8002/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "你好世界", "speed": 0.7}' \
  -o output.wav

# 语音识别（faster-whisper）
curl -s -X POST http://localhost:8002/api/stt/transcribe \
  -F "file=@recording.webm"
```

### 苏格拉底追问 + 理论

```bash
# 苏格拉底模式问答（AI 引导思考，不直接给答案）
curl -s -X POST http://localhost:8002/api/curiosity/ask-socratic \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "为什么树叶会变色？"}'

# 孩子回答苏格拉底追问
curl -s -X POST http://localhost:8002/api/curiosity/socratic-answer \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"event_id": 1, "child_response": "因为秋天到了"}'

# 创建孩子自建理论
curl -s -X POST http://localhost:8002/api/theory \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"title": "树叶变色的秘密", "content": "树叶变色是因为秋天天气变冷了...", "linked_curiosity_event_id": 1}'

# 查看孩子的理论列表
curl -s http://localhost:8002/api/theory -H "X-Student-ID: 1"
```

### 精读计划 (V2.0)

```bash
# 创建精读计划（4周×5天）
curl -s -X POST http://localhost:8002/api/plan/create -H "X-Student-ID: 1"

# 获取当前计划（含所有天的状态）
curl -s http://localhost:8002/api/plan/current -H "X-Student-ID: 1"

# 开始某天的精读（LLM 生成教案 + 文章，种子优先）
curl -s -X POST http://localhost:8002/api/plan/days/1/start -H "X-Student-ID: 1"

# 完成某天的精读（提交 3-4 题答案数组）
curl -s -X POST http://localhost:8002/api/plan/days/1/complete \
  -H "X-Student-ID: 1" \
  -H "Content-Type: application/json" \
  -d '{"answers": [
    {"question_type":"find_clue","question":"...","child_answer":"...","is_correct":true},
    {"question_type":"infer_cause","question":"...","child_answer":"...","is_correct":true},
    {"question_type":"connect_life","question":"...","child_answer":"...","is_correct":true},
    {"question_type":"main_question","question":"...","child_answer":"...","is_correct":true}
  ]}'

# 查看文章的精读记录
curl -s http://localhost:8002/api/articles/1/reading-record -H "X-Student-ID: 1"
```

### 种子池

```bash
# 列出所有种子
curl -s http://localhost:8002/api/seeds -H "X-Student-ID: 1"

# 筛选 pending 种子
curl -s http://localhost:8002/api/seeds?status=pending -H "X-Student-ID: 1"

# 手动触发种子生长（生成回答文章）
curl -s -X POST http://localhost:8002/api/seeds/1/grow -H "X-Student-ID: 1"
```

### 知识图谱

```bash
# 获取知识图谱
curl -s http://localhost:8002/api/knowledge/graph -H "X-Student-ID: 1"

# 获取单个概念
curl -s http://localhost:8002/api/knowledge/nodes/光合作用 -H "X-Student-ID: 1"
```

### 其他

```bash
# 健康检查
curl -s http://localhost:8002/api/health

# 学生列表
curl -s http://localhost:8002/api/students/ -H "X-Student-ID: 1"

# 统计总览
curl -s http://localhost:8002/api/stats/overview -H "X-Student-ID: 1"

# 五维能力雷达
curl -s http://localhost:8002/api/stats/radar -H "X-Student-ID: 1"

# 家长控制台
curl -s http://localhost:8002/api/parent/students -H "X-Student-ID: 1"
```

### 前端路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | HomePage | 首页仪表盘 |
| `/plan` | PlanPage | 精读计划（V2.0 核心） |
| `/reading/:dayId` | ReadingSessionPage | 四阶段精读会话 |
| `/articles` | ArticleHistoryPage | 文章历史（点击查看精读记录） |
| `/curiosity` | CuriosityPage | 好奇心问答 |
| `/characters` | CharacterZonesPage | 生字四区看板 |
| `/knowledge` | KnowledgeGraphPage | 知识图谱（点击概念查看文章） |
| `/stats` | StatsPage | 学习统计 |
| `/series/:seriesId` | SeriesReaderPage | 系列文章阅读 |

## 注意事项

- LLM 生成 API 超时 120 秒（前端），LangGraph 内部节点超时 30-60 秒，AI 响应可能较慢
- 环境通过 `APP_ENV` 控制：开发 (development) 前端 :3002 + 后端 :8002；正式 (production) 前端 :3001 + 后端 :8001
- 端口由 `.env.dev` / `.env.prod` 和 `frontend/.env.development` / `frontend/.env.production` 统一管理，`vite.config.ts` 和 `run.py` 自动读取，不同步会请求失败
- 生字拼音标注仅处理 CJK 统一汉字区间 `[一-鿿]`
- `get_current_student_id` 自己打开数据库会话（非 FastAPI 依赖注入），注意调用链中不要额外开启事务
- 中间件验证 student_id 是否存在且活跃，不存在则回退到第一个活跃学生。dev DB 默认学生可能是 id=2（不是 1），前端 localStorage 存的 studentId 可能不匹配——中间件自动容错
- 没有测试框架和 lint 工具 —— 建议从 `pytest` + `ruff`（后端）和 `eslint` + `prettier`（前端）开始
- 新增领域模块：创建 `router.py` / `service.py` / `repository.py` → `main.py` 中 `include_router` → 前端在 `services/api.ts` 添加 API 对象
- `students/` 和 `tts/` 领域较薄——只有 router（tts 有 service），没有 repository
- 好奇心模块 (curiosity/) 和 TTS 模块 (tts/) 与字库系统独立，改动字库不影响它们
- edge-tts 需 ≥7.2.8 版本（旧版令牌过期导致 403）
- STT 语音识别依赖本地 faster-whisper 模型和 ffmpeg（非 WAV 格式需 ffmpeg 转码为 16kHz 单声道 PCM）
- 前端语音输入使用 MediaRecorder（非 Web Speech API，国内 Google 服务不可用）
<<<<<<< Updated upstream
=======
- **数据库 schema 同步**：`Base.metadata.create_all()` 只增列不删列。修改 ORM 模型后如果 MySQL 表有孤儿列（如 `last_updated_at` vs `updated_at`），需要手动 `ALTER TABLE`。`theory` 表、`knowledge_node` 表曾因此导致 500
- **STT `file.read()` 必须是 `await`**：`UploadFile.read()` 是 async，路由函数必须声明 `async def` 并 `await file.read()`，否则返回 coroutine 对象导致 500
- **`file.size` 为 0 时**：Starlette `UploadFile.size` 可能为 0 或 None，0 字节文件走不到 guard 但会被 `< 100` 检查拦截返回空文本
- **LLM JSON 解析容错**：`start_day` 用 LLM 生成教案 JSON，解析失败时自动回退到旧模式（简单文章+一道题）。不要假设 LLM 一定输出合法 JSON
- **`asyncio.run()` 不能在已有事件循环中调用**：后端所有 LLM 调用都用 `asyncio.run()` 包装，只能在同步函数中使用

## Git 工作流

- **禁止在 master/main 分支上直接修改代码或提交**
- 新功能/修复必须先创建 feature 分支：`git checkout -b feature/xxx`
- 如果发现自己在 master 上，立即停止并提醒用户切分支
- 例外：用户明确说"这是紧急修复，直接在 master 上改"（需用户主动声明）
>>>>>>> Stashed changes
