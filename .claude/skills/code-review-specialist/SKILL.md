---
name: code-review-specialist
description: 全面的代码审查，包括安全性、性能和质量分析。当用户要求审查代码、分析代码质量、评估拉取请求时使用，或在提及代码审查、安全分析或性能优化时使用。
---

# Code Review Skill

此技能提供全面的代码审查能力，重点关注：

1. **Security Analysis**
   - 认证/授权问题
   - 数据暴露风险
   - 注入漏洞
   - 加密弱点
   - 敏感数据日志记录

2. **Performance Review**
   - 算法效率（大 O 分析）
   - 内存优化
   - 数据库查询优化
   - 缓存机会
   - 并发问题

3. **Code Quality**
   - SOLID 原则
   - 设计模式
   - 命名约定
   - 文档
   - 测试覆盖率

4. **Maintainability**
   - 代码可读性
   - 函数大小（应 < 50 行）
   - 圈复杂度
   - 依赖管理
   - 类型安全

## Reference Files

此技能包含支持文件，你在执行审查时应阅读这些文件：

- **`templates/review-checklist.md`** — 结构化的检查清单，涵盖安全性、性能、质量和测试。阅读此文件并将其作为指南，确保审查期间不遗漏任何类别。
- **`templates/finding-template.md`** — 用于记录单个发现的标准模板，包含严重程度、位置、代码示例和影响分析。阅读此文件并在报告问题时使用其格式。
- **`scripts/analyze-metrics.py`** — 计算代码指标（函数数量、类数量、平均行长、复杂度分数）的 Python 脚本。对审查的文件运行此脚本以收集定量数据。
- **`scripts/compare-complexity.py`** — 比较文件两个版本之间的圈复杂度和认知复杂度的 Python 脚本。在审查重构更改时，使用前后版本运行此脚本。

## Review Template

对于每段审查的代码，提供：

### Summary
- 整体质量评估（1-5）
- 关键发现数量
- 推荐的优先领域

### Critical Issues (if any)
- **问题**：清晰描述
- **位置**：文件和行号
- **影响**：为什么这很重要
- **严重程度**：Critical/High/Medium
- **修复**：代码示例

### Findings by Category

#### Security (if issues found)
列出安全漏洞及示例

#### Performance (if issues found)
列出性能问题及复杂度分析

#### Quality (if issues found)
列出代码质量问题及重构建议

#### Maintainability (if issues found)
列出可维护性问题及改进建议

## Version History

- v1.0.0 (2024-12-10)：初始版本，包含安全性、性能、质量和可维护性分析
