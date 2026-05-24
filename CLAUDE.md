# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

俊宜阅读 — AI 驱动的儿童中文阅读应用。生成适配认知水平的短文，拼音标注、语音朗读、生字分区管理和好奇心问答引擎。

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
- **AI**: DeepSeek (LLM), Edge-TTS (语音), CogView/GLM (图片)
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
│                       CuriosityEvent, ArticleReadStatus)
├── domains/         领域模块 (router → service → repository 模式)
│   ├── articles/    文章生成/历史/系列/已读状态
│   │   └── generator.py  提取汉字 + 构建 LLM prompt（注入字库上下文）
│   ├── characters/  生字四区 + 统计(stats_router.py) + 交互追踪 + 自动晋升引擎
│   ├── curiosity/   好奇心问答 (含 LangGraph 状态图 graph.py)
│   ├── students/    学生列表（只读，仅 router）
│   └── tts/         语音合成 (仅 router + service，无 repository)
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
- **文章生成联动** — 生成文章时注入字库上下文到 LLM prompt（已掌握的字放心用、学习中的字多重复、困难字重点复习）

### 其他模式

- **认知分级**: `config.py` 中 `COGNITION_MAX_LEVEL`(1-3) 控制文章难度，每个等级有对应的 `COGNITION_PROMPTS` 指导 LLM 生成。`ADVANCED_KEYWORDS` 包含高级关键词（因为/所以/原理/原子/基因/宇宙等），当文章主题或生字触发这些词时临时提升认知等级，确保高级话题给出更深度的解释。
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
| `COGNITION_MAX_LEVEL` | 认知等级上限 (1-3) | 3 | 3 |

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

### 语音合成

```bash
# 合成语音（返回 WAV）
curl -s -X POST http://localhost:8002/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "你好世界", "speed": 0.7}' \
  -o output.wav
```

### 其他

```bash
# 健康检查
curl -s http://localhost:8002/api/health

# 学生列表
curl -s http://localhost:8002/api/students/ -H "X-Student-ID: 1"

# 统计总览
curl -s http://localhost:8002/api/stats/overview -H "X-Student-ID: 1"
```

### 前端路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | HomePage | 首页仪表盘 |
| `/articles` | ArticleHistoryPage | 文章历史列表 |
| `/curiosity` | CuriosityPage | 好奇心问答 |
| `/characters` | CharacterZonesPage | 生字四区看板 |
| `/stats` | StatsPage | 学习统计 |
| `/series/:seriesId` | SeriesReaderPage | 系列文章阅读 |

## 注意事项

- LLM 生成 API 超时 120 秒（前端），LangGraph 内部节点超时 30-60 秒，AI 响应可能较慢
- 环境通过 `APP_ENV` 控制：开发 (development) 前端 :3002 + 后端 :8002；正式 (production) 前端 :3001 + 后端 :8001
- 端口由 `.env.dev` / `.env.prod` 和 `frontend/.env.development` / `frontend/.env.production` 统一管理，`vite.config.ts` 和 `run.py` 自动读取，不同步会请求失败
- 生字拼音标注仅处理 CJK 统一汉字区间 `[一-鿿]`
- `get_current_student_id` 自己打开数据库会话（非 FastAPI 依赖注入），注意调用链中不要额外开启事务
- 没有测试框架和 lint 工具 —— 建议从 `pytest` + `ruff`（后端）和 `eslint` + `prettier`（前端）开始
- 新增领域模块：创建 `router.py` / `service.py` / `repository.py` → `main.py` 中 `include_router` → 前端在 `services/api.ts` 添加 API 对象
- `students/` 和 `tts/` 领域较薄——只有 router（tts 有 service），没有 repository
- 好奇心模块 (curiosity/) 和 TTS 模块 (tts/) 与字库系统独立，改动字库不影响它们
- edge-tts 需 ≥7.2.8 版本（旧版令牌过期导致 403）
