# 安全智能体系统 · 前端（运营看板 MVP 单页框架 v5）

本仓库为**安全大模型平台智能体系统**的前端模块，提供一个**无需构建工具、双击即可打开**的单页运营看板（Dashboard），用于可视化展示事件列表、告警关联、风险研判、可审计处理时间线、处置记录与关键指标。

> 设计原则：前端只做展示层；Agent 核心逻辑与工具调用在深信服平台侧开发；本仓库通过 HTTP 接口与后端（`spark-sec-agent-be`）对接，字段命名严格对齐 `sec_agent/domain/models.py`（snake_case）。

## 一、项目简介

- **定位**：MVP 最小可运行前端框架，用于演示主链主要状态流转与接口对接能力。
- **技术栈**：原生 HTML + CSS + JavaScript（ES6），**无第三方依赖**，不依赖 Node.js / npm / Webpack。
- **运行方式**：双击 `index.html` 即可在浏览器打开；默认走内嵌演示数据（Mock），后端不可用时自动降级。
- **适用场景**：组长/评委演示、前后端接口联调、运营看板原型验证。

## 二、文件结构

```
spark-sec-agent-fe/
├── index.html          # 单页入口（三段式布局：列表 + 详情 + 指标）
├── app.js              # 数据层 + 渲染逻辑 + 审批弹窗交互
├── demo-data.js        # 演示数据（人工构造 Mock，字段对齐 models.py）
├── styles.css          # 深色后台样式
├── README.md           # 本文件
├── assets/             # 静态资源（截图等，须脱敏后提交）
├── docs/
│   └── modules/
│       └── frontend/   # 前端模块文档（团队规范目录）
│           ├── design.md        # 设计说明
│           ├── development.md   # 开发运行说明
│           └── test.md          # 测试案例与结果
└── .gitignore
```

## 三、运行方式

### 方式一：直接打开（演示模式，推荐首次体验）

双击 `index.html`，浏览器打开后即可看到运营看板。此时：

- 页面右上角提示：**"数据来源：演示数据（后端未启动，已自动降级）"**。
- 事件列表覆盖 4 种代表性状态：`COMPLETED` / `INVESTIGATING` / `APPROVAL_REQUIRED` / `FAILED`。
- 所有渲染均基于 `demo-data.js` 内嵌数据，不发起任何网络请求。

### 方式二：对接真实后端

1. 启动后端服务（李雨妍维护的 `spark-sec-agent-be`）：
   ```bash
   cd spark-sec-agent-be
   uvicorn sec_agent.main:app --reload --root-path src
   ```
2. 确认后端运行在 `http://localhost:8000`（可在 `app.js` 顶部 `API_BASE` 常量修改地址）。
3. 刷新 `index.html`，页面自动改走真实接口；接口不可达时自动回退演示数据。

### 调试方法

- 打开浏览器开发者工具（F12）→ **Console** 面板查看数据请求日志与错误；**Network** 面板查看接口请求/响应详情。

## 四、接口契约（对齐 `api/routes/events.py`）

| 接口路径 | 方法 | 请求参数 | 响应主体（对齐 models.py） | 前端用途 |
|---|---|---|---|---|
| `/events` | GET | 无 | `EventListItem[]` | 左侧事件列表 |
| `/events/{event_id}` | GET | path param `event_id` | `SecurityEvent` | 右侧详情（告警关联/研判） |
| `/events/{event_id}/timeline` | GET | path param `event_id` | `TimelineEntry[]` | 可审计处理时间线 |
| `/events/{event_id}/approval` | POST | body: `ApprovalDecision` | `{"status": "ok"}` | 审批弹窗提交 |
| `/metrics` | GET | 无 | 指标聚合对象 | 底部关键指标卡片 |
| `/runs` | POST | body: `StartRunRequest` | 触发一次分析运行 | （可选）演示数据生成 |

### 审批接口字段（`ApprovalDecision`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `approved` | bool | 审批决定（true=同意执行 / false=驳回） |
| `approver` | str | 审批人姓名 |
| `reason` | str | 审批意见 |
| `idempotency_key` | str | 防重提交键（前端 `crypto.randomUUID()` 生成） |

## 五、数据项与字段对照（对齐 `domain/models.py`）

| 前端区域 | 使用的模型 / 字段 |
|---|---|
| 事件列表行 | `EventListItem`：`event_id` `run_id` `trace_id` `status` `source` `summary` |
| 告警关联 | `SecurityEvent`：`summary` `correlation_reason` `alert_count_before` `event_count_after` `entities` |
| 风险研判 | `TriageResult`：`verdict` `confidence` `risk_score` `priority` `supporting_evidence_refs` `opposing_evidence_refs` `evidence_gaps` |
| 调查证据链 | `InvestigationReport.steps[]`：`step_no` `goal` `tool_request` `observation` |
| 处置记录 | `ResponseResult`：`plan` `execution.mode` `verification.status` / `final_status` |
| 状态时间线 | `TimelineEntry`：`at` `status` `message` `elapsed_ms` |
| 审批弹窗 | `ApprovalDecision`：`approved` `approver` `reason` `idempotency_key` |

### 11 种业务状态颜色映射

| 状态 | 颜色 | 含义 |
|---|---|---|
| `RECEIVED` | 灰 | 已接收 |
| `CORRELATING` | 蓝 | 关联分析中 |
| `TRIAGED` | 蓝 | 已完成分级研判 |
| `INVESTIGATING` | 蓝 | 深度调查中 |
| `DECISION_READY` | 青 | 处置决策就绪 |
| `APPROVAL_REQUIRED` | 红（闪烁） | 需人工审批 |
| `EXECUTING` | 橙 | 处置执行中 |
| `VERIFYING` | 橙 | 处置效果验证中 |
| `COMPLETED` | 绿 | 已闭环 |
| `HUMAN_REQUIRED` | 红 | 需人工介入 |
| `FAILED` | 灰 | 失败/异常 |

## 六、演示数据说明

- **来源**：`demo-data.js` 为**人工构造**的 Mock 数据，不包含任何真实平台数据。
- **标注**：文件头部已注明数据性质（`人工构造 Mock，字段对齐 domain/models.py`）。
- **降级策略**：`app.js` 先尝试 `fetch` 真实接口，捕获网络错误/非 2xx 后自动切换到 `demo-data.js`，保证演示不中断。
- **指标数据**：底部 KPI 卡片在无真实数据时显示"暂无数据"，有模拟数据时明确标注"演示数据，不替代真实评测指标"。

## 七、安全与合规

- 前端不存储任何敏感信息（账号、密码、Token、内网地址）。
- 禁止提交平台原始截图、真实返回、凭据与接入码；如需截图须先脱敏再放 `assets/`。
- 审批 `idempotency_key` 由前端 `crypto.randomUUID()` 生成，防止网络重试导致重复提交。

---

**维护者**：黄佳丽 · **所属模块**：frontend · **任务编号**：T0822-frontend-basic-page
