---
name: stt-debug
description: "Debug voice input / STT 语音识别故障 — 按链路逐层排查: 浏览器录音 → 网络上传 → 后端 ffmpeg → faster-whisper → zhconv → 前端展示"
metadata:
  type: debug
  priority: high
---

# STT 语音识别排错 Skill

当语音输入（VoiceInputButton）报错、识别为空、或行为异常时，使用此 skill 逐层排查。

## 前置

先读取项目记忆了解完整架构：

```
Read C:\Users\Administrator\.claude\projects\I--python-study-pypro2605-JoyReadsSystem\memory\voice-input-stt.md
```

## 排查链路（严格按顺序）

### Layer 1 — 浏览器录音

```
前端 useVoiceInput hook → MediaRecorder 录制
```

**检查项**：
1. 浏览器控制台是否有 `麦克风权限被拒绝` 或 `无法访问麦克风` 的 antd message 错误
2. 检查 `navigator.mediaDevices?.getUserMedia` 是否存在（IE/旧 WebView 不支持）
3. MediaRecorder 选择的 MIME 类型（console.log `selectedMime`）：Chrome 通常是 `audio/webm;codecs=opus`
4. `chunksRef.current` 是否为空（`没有录到声音` 错误）
5. 录音时长是否 < 600ms（`录音时间太短` 错误）

**常见问题**：
- Chrome 自动播放策略：用户必须先交互才能获取音频权限
- Android WebView：需配置 `android.webkit.PermissionRequest` 支持
- HTTP 页面（非 HTTPS）：`getUserMedia` 需要安全上下文

### Layer 2 — 网络上传

```
sttApi.transcribe(blob, ext) → POST /api/stt/transcribe
```

**检查项**：
1. Network 面板查看 `/api/stt/transcribe` 请求：状态码、请求体大小
2. 413 → 文件超过 20MB
3. 500/502 → 后端异常，跳 Layer 3
4. CORS 错误 → 检查 `main.py` 中的 `allow_origins`

**常见问题**：
- Vite proxy 配置未转发 `/api/stt` → 检查 `vite.config.ts` 中 proxy 配置
- 402/426 等非预期状态码 → 后端未启动或端口冲突

### Layer 3 — 后端 ffmpeg 转码

```
router.py → 接收文件 → 保存 debug dump → STTService.transcribe()
```

**检查项**：
1. 查看后端日志（uvicorn 终端输出）：
   - `STT: ffmpeg at <path>` — ffmpeg 已找到
   - `STT: ffmpeg not found` — 非 WAV 格式会失败
   - `STT: audio too small (<100 bytes)` — 上传内容为空
2. 检查 debug dump 文件：`ls -la %TEMP%/stt_debug/` — 看最新文件的音频是否有声音
3. 检查 ffmpeg 转换日志：`STT ffmpeg failed` — ffmpeg 子进程报错

**常见问题**：
- ffmpeg 不在 PATH：WinGet 安装路径 `%LOCALAPPDATA%\Microsoft\WinGet\Links\ffmpeg.exe`，已硬编码回退
- ffmpeg 超时（30s）：大文件或损坏的音频
- 非 WAV 格式且无 ffmpeg → 返回空文本

### Layer 4 — faster-whisper 识别

```
ffmpeg 输出 16kHz WAV → WhisperModel.transcribe()
```

**检查项**：
1. 后端日志：`STT transcription failed: <type>: <msg>` — 模型推理错误
2. HF 镜像是否可达：`HF_ENDPOINT=https://hf-mirror.com`
3. 模型是否已下载：首次运行时下载 ~300MB（base 模型），后续使用本地缓存
4. 识别参数：
   - `language="zh"` — 只识别中文
   - `no_speech_threshold=0.6` — 高于 0.6 判定为无语音
   - `condition_on_previous_text=False` — 防止幻觉串联

**常见问题**：
- 首次启动后第一个请求慢（下载模型）→ 等待
- `no_speech_threshold=0.6` 太高 → 安静环境也会返回空（降低到 0.4）
- 识别繁体中文 → 下一步 zhconv 会转简体

### Layer 5 — 前端展示

```
后端返回 {"text": "...", "language": "zh"} → useVoiceInput.onstop → onResult(text)
```

**检查项**：
1. Network 面板看响应体 `text` 字段是否为空
2. 前端 if (text) → `onResultRef.current?.(text)` 是否被调用
3. `setError('没有识别出文字')` 是否触发（antd message 红色提示）

**常见问题**：
- 后端返回 `{"text": "", "language": "unknown"}` → 排查 Layer 3/4
- 后端返回了 text 但前端没填入 → 检查 `onResult` 回调逻辑

## 快速诊断命令

```bash
# 检查后端 STT 是否正常（发一个测试音频）
curl -s -X POST http://localhost:8002/api/stt/transcribe \
  -F "file=@test.wav"

# 检查 debug dump 目录
ls -lt $TEMP/stt_debug/ | head -5

# 检查 faster-whisper 模型缓存
ls -la ~/.cache/huggingface/hub/ 2>/dev/null || ls -la ~/.cache/huggingface/ 2>/dev/null

# 测试 ffmpeg 可用性
ffmpeg -version 2>&1 | head -1
```

## 不做什么

- **不用 Web Speech API / SpeechRecognition** — Google 服务在国内不可用
- **不用 Web Audio API GainNode 做前端增益** — 会失真，用后端 ffmpeg volume 滤镜
- **不跳过 ffmpeg 转码** — faster-whisper 的 av 库无 Opus 解码器
- **不删除 %TEMP%/stt_debug** — 调试依赖这些文件
