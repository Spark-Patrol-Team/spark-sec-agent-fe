# 前端（黄佳丽）· 接口对齐 MVP 单页框架 v5

## 一、设计原则
- 严格对照李雨妍仓库：`api/routes/events.py` 等路由 + `domain/models.py` 数据模型。
- 字段命名沿用后端 snake_case（`event_id`/`trace_id`/`risk_score`/`evidence_gaps`/`idempotency_key` 等）
- 单页三段式：事件列表 + 事件详情（可审计处理时间线）+ 关键指标。
- 后端不可用时自动降级到 `demo-data.js`（字段结构与 models.py 一致），保证演示不中断。

## 二、前端区域 ↔ 后端接口/字段 对照表

| 前端区域 | 接口/数据对象（李雨妍仓库） | 使用的字段 |
|---|---|---|
| 事件列表 | `GET /events` → `list[EventListItem]` | `event_id` `run_id` `trace_id` `status` `source` `summary` |
| 详情·基本信息 | `GET /events/{id}` → `EventContext` | `event_id` `trace_id` `run_id` `status` `source` `alert_refs` |
| 详情·告警关联 | `EventContext.event_summary: SecurityEvent` | `summary` `correlation_reason` `alert_count_before` `event_count_after` `entities` |
| 详情·风险研判 | `EventContext.triage: TriageResult` | `verdict` `confidence` `risk_score` `priority` `supporting_evidence_refs` `opposing_evidence_refs` `evidence_gaps` `should_investigate` `summary` |
| 详情·调查证据链 | `EventContext.investigation: InvestigationReport` | `steps[].step_no/goal/tool_request/observation` `conclusion` `key_evidence_refs` `unresolved_questions` `recommended_actions` `needs_human` |
| 详情·处置记录 | `EventContext.response: ResponseResult` | `plan.{action,target,reason,risk_level,approval_required}` `execution.{mode,platform_status,executed,error}` `verification.{status,final_status,method}` |
| 详情·状态时间线 | `GET /events/{id}/timeline` → `list[TimelineEntry]`（或 `EventContext.timeline`） | `at` `status` `message` `elapsed_ms` |
| 审批弹窗 | `POST /events/{id}/approval` ← `ApprovalDecision` | `approved` `approver` `reason` `idempotency_key`（前端 `crypto.randomUUID`） |
| 关键指标 | `GET /metrics` | `total_events` `completed_events` `human_required_events` `failed_events` `note` |

## 三、业务状态（对照 `BusinessStatus`）
`RECEIVED → CORRELATING → TRIAGED → INVESTIGATING → DECISION_READY → APPROVAL_REQUIRED → EXECUTING → VERIFYING → COMPLETED / HUMAN_REQUIRED / FAILED`

## 四、运行方式
1. 双击 `index.html` 即可打开（默认走演示数据，右上角提示“后端未启动，已自动降级”）。
2. 李雨妍后端在 `http://localhost:8000` 启动后，页面自动改走真实接口（`/events` `/events/{id}` `/events/{id}/timeline` `/metrics`）；接口不可达时自动回退演示数据。
3. 处于 `APPROVAL_REQUIRED` 的事件显示“审批”按钮，弹窗提交 `ApprovalDecision` 四字段。

## 五、与要求文档的对齐
- 仅展示一个深度调查 Agent（区域标题“调查证据链/可审计处理时间线”）。
- 无真实数据时 KPI 显示 `--` 并附 `note`（标注“演示数据/不统计准确率”）。
- 审批弹窗使用 `idempotency_key` 保证幂等，符合安全处置闭环要求。
- 后续接入真实 XDR 数据后，可移除/缩减 `demo-data.js` 的内嵌数据，改为纯接口驱动。
