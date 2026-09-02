# 安全事件运营看板前端联调开发说明

## 0. 文档信息

| 项目 | 内容 |
|---|---|
| 模块 | 安全事件运营看板前端联调 |
| 负责人 | 黄佳丽 |
| 文档状态 | 当前有效 |
| 实现状态 | 已复验 |
| 能力性质 | 自研代码 |
| 关联任务/需求 | 用真实后端数据完成联调 |
| 关联正式交付章节 | 前端联调模块 |
| 对应PR或Commit | spark-sec-agent-fe/main |
| 适用代码版本 | 分支 main |
| 最后更新时间 | 2026-08-26 |

## 1. 当前实现摘要

### 1.1 已实现

- 前端页面（index.html + app.js + demo-data.js + styles.css）可运行于 `http://localhost:8080`。
- 调用后端 5 个接口均成功（200 OK），数据正确渲染。
- 修复了 `app.js` 中 `renderDetail` 函数因 `$("#cur-trace")` 为 null 导致点击事件失效的 Bug。
- 后端 `app.py` 中添加了 CORS 中间件，允许 `localhost:8080`、`127.0.0.1:8080` 等来源跨域。

### 1.2 未实现或未复验

- 未增加前端"生成测试数据"按钮（可通过 Swagger 手动调用 `POST /runs` 替代）。

## 2. 代码位置

| 路径 | 主要对象/入口 | 作用 |
|---|---|---|
| `spark-sec-agent-be\src\sec_agent\api\app.py` | `create_app()` 函数中的 CORS 中间件 | 允许前端跨域访问 |
| `spark-sec-agent-fe/blob/main/index.html` | 页面结构 | 运营看板布局 |
| `spark-sec-agent-fe/blob/main/app.js` | `renderDetail`, `loadEvents`, `loadMetrics`, `submitApproval` 等函数 | 前端业务逻辑与 API 调用 |
| `spark-sec-agent-fe/blob/main/demo-data.js` | Mock 数据 | 后端不可用时的降级数据 |

## 3. 依赖与配置

| 名称 | 必需/可选 | 获取方式 | 未配置时行为 |
|---|---|---|---|
| Python 3.11 + venv311 | 必需 | 本地虚拟环境 | 后端无法启动 |
| uvicorn | 必需 | pip install uvicorn | 后端无法启动 |
| fastapi | 必需 | pip install fastapi | 后端无法启动 |
| 后端服务 `http://127.0.0.1:8000` | 必需 | 本地启动 | 前端自动降级为演示模式 |

- 支持的运行环境：Windows 11，Python 3.11，Chrome 浏览器。
- 敏感配置：无。

## 4. 启动与调试

```text
# 启动后端（在 spark-sec-agent-be 目录下）
.\venv311\Scripts\activate
uvicorn sec_agent.api.app:app --reload --app-dir src

# 启动前端（在另一个 CMD 窗口，前端文件所在目录）
python -m http.server 8080
```

- 成功判据：浏览器访问 `http://localhost:8080` 可看到运营看板，右上角显示"数据来源：后端接口（真实数据）"。
- 常见失败及排查：
  - 后端端口被占用：更换端口或关闭占用进程。
  - 前端无法加载：检查 CMD 窗口是否正常输出 `Serving HTTP on 0.0.0.0 port 8080`。
  - 跨域报错：确认后端 `app.py` 中 CORS 中间件已添加，且 `allow_origins` 包含 `http://localhost:8080`。

## 5. 调用与接入方法

### 5.1 调用入口

- 前端页面：`http://localhost:8080/index.html`
- 后端 API 基址：`http://127.0.0.1:8000`

### 5.2 最小示例

```text
# 请求：获取事件列表
GET http://127.0.0.1:8000/events
```

```text
# 响应示例（脱敏）
[
  {
    "event_id": "evt-544e54e7...",
    "title": "可疑横向移动检测",
    "status": "open",
    "severity": "high",
    "created_at": "2026-08-26T03:56:21"
  }
]
```

### 5.3 上下游接入注意事项

- 所有 API 调用均在 `app.js` 中以 `fetch` 实现，Base URL 定义为 `const API = 'http://127.0.0.1:8000'`。
- 审批接口为 POST，需携带 `Content-Type: application/json`，body 包含 `action`、`comment`、`approver`。
- 后端不可用时，前端自动加载 `demo-data.js` 中的 Mock 数据，并显示"数据来源：演示数据"。

## 6. 异常处理与安全控制

- 输入错误：审批表单中 action 必选（approve/reject），comment 和 approver 为非空字符串。
- 依赖或工具失败：后端不可用时前端静默降级，Console 输出警告。
- 重复调用与幂等：审批接口幂等性由后端保证，前端不做额外处理。
- 超时、重试与回滚：未实现超时重试（MVP 阶段）。
- 权限、审批与敏感数据：前端不处理鉴权，敏感数据已在展示前脱敏。

## 7. 真实平台、Mock与fallback边界

| 能力 | 当前实际实现 | 触发条件 | 不得误写为 |
|---|---|---|---|
| 事件列表加载 | 真实后端 API | 后端运行且返回 200 | 不能写为"Mock" |
| 事件详情加载 | 真实后端 API | 同上 | 同上 |
| 时间线加载 | 真实后端 API | 同上 | 同上 |
| 指标加载 | 真实后端 API | 同上 | 同上 |
| 审批提交 | 真实后端 API | 同上 | 同上 |
| 演示模式 | Mock（demo-data.js） | 后端不可用或返回非 200 | 不能写为"真实平台" |

## 8. 已知限制与待办

| 优先级 | 事项 | 是否影响主链 | 负责人/完成条件 |
|---|---|---|---|
| P1 | 前端未增加"生成测试数据"按钮 | 否（可通过 Swagger 手动生成） | 黄佳丽 / 可选优化 |

## 9. 运行观测、版本兼容与迁移

- 日志与关键指标位置：浏览器 F12 Console 可看到 `[API]` 前缀的请求日志。
- 健康检查或运行状态判断：前端页面右上角显示数据来源标识。
- 兼容的接口/Schema/平台版本：后端 API 版本 v1（当前）。
- 升级、迁移或回退注意事项：无。

## 10. 变更记录

| 日期 | PR/Commit | 实现变化 | 相关测试 |
|---|---|---|---|
| 2026-08-26 | spark-sec-agent-fe/main | 修改版本，记录前端联调实现 | 见 test.md |



# T0827-04 开发说明

## 1. 代码改动范围
- 修改 `app.js`：重构请求逻辑，增加来源标签渲染、异常处理和降级判断。
- 修改 `demo-data.js`：调整降级触发阈值，增加提示文案。

## 2. 本地运行环境
- **前端**：Python 3 内置服务 `python -m http.server 8080`
- **后端**：Uvicorn `uvicorn sec_agent.api.app:app --reload --app-dir src` (端口 8000)

## 3. 关键函数说明
- `jfetch(url, options)`: 封装了 fetch，增加了 10s 超时控制和 try-catch。
- `checkFallbackNeeded(response)`: 判断是否触发降级。
- `renderSourceTag(sampleNature)`: 渲染来源标签。

# T0828-04 开发说明

## 一、代码改动范围

### 1. `app.js`（前端核心逻辑）

- **新增 `backendAvailable` 标志**：用于准确判断后端是否曾经成功响应，区分"后端可用但返回空"与"后端完全不可用"。
- **修复 `loadAll` 降级逻辑**：只有 `/events` 与 `/metrics` **两个接口都失败**时才降级到 `demo-data.js`；任一成功即视为后端可用（包括返回空数组）。
- **来源标签动态化（`updateSourceTag`）**：依据事件数据的 `sample_nature` / `source` 字段，将页面右上角标签区分为以下四类：
  - `real_xdr` → 真实 XDR 数据
  - `fixed_sample` → 固定样例
  - `fixed_sample_fallback` → 固定样例（回退）
  - `demo` → 演示数据
  - 后端完全不可用时（`usingDemo=true`）→ 演示数据（前端降级）
- **修复 `renderDetail` 降级逻辑**：后端可用时，详情接口失败只显示错误提示，不再静默使用演示数据；仅后端完全不可用时才回退到 `DEMO_EVENTS`。
- **`jfetch` 增加 10 秒超时控制**：通过 `AbortController` 实现，超时后中断请求并返回 `null`，触发降级链路。
- **`renderList` 修复点击事件**：为事件行元素显式设置 `data-id`，确保点击行任意区域均可打开详情。
- **`renderMetrics` 空值保护**：`metrics` 为 `null` 时指标卡片显示 `--`，避免空指针报错。
- **新增全局错误兜底（`window.onerror`）**：未捕获异常时显示"系统繁忙，请稍后重试"并提供重新加载入口，避免白屏。

### 2. `demo-data.js`

- 保持固定样例数据不变，作为后端不可用时的降级数据源。
- 数据项中可包含 `sample_nature` / `source` 字段，用于前端标签判定（取值：`fixed_sample`、`demo` 等）。

## 二、本地运行环境

### 前端（端口 8080）

```bash
# 进入前端目录后使用内置静态服务器启动
python -m http.server 8080
```

启动后访问：http://localhost:8080

> 若 8080 端口被占用，可替换为其他端口（如 8081），并同步修改 `app.js` 中的 `API` 地址。

### 后端（端口 8000）

```bash
#进入后端目录
.\venv311\Scripts\activate
uvicorn sec_agent.api.app:app --reload --app-dir src
```

启动成功后访问：http://localhost:8000
交互式 API 文档（Swagger）：http://localhost:8000/docs

### 关键版本

- 前端 Commit：`01b42e6`（分支 `feature/frontend-resilience-0827`，PR #23）
- 后端候选 Commit：`9b3a394`（`main`）
- Python：3.11（`StrEnum`、`ZoneInfo` 等新特性依赖此版本）

## 三、关键函数说明

### 1. `jfetch(url, timeoutMs = 10000)`

统一封装的 fetch 请求函数。

- 通过 `AbortController` 实现 `timeoutMs` 毫秒超时控制。
- 超时（`AbortError`）或网络异常时控制台告警并返回 `null`。
- HTTP 非 2xx 状态直接抛出，由调用方统一判空处理。

### 2. `loadAll()`

页面初始化数据加载入口。

- 依次请求 `/events` 与 `/metrics`，根据两者成败设置 `backendAvailable` 标志。
- **双接口均失败**才降级到 `demo-data.js`；否则按真实数据渲染（允许空数组）。
- 加载完成后调用 `updateSourceTag()` 刷新来源标签。

### 3. `updateSourceTag()`

来源标签动态判定函数（本轮核心改动）。

- 依据首条事件的 `sample_nature`（优先）或 `source` 字段映射为对应文案。
- 后端完全不可用时固定显示"演示数据（前端降级）"。
- 未知来源显示原始值，避免让用户猜测。

### 4. `checkFallbackNeeded()`

判定是否需要降级（辅助函数）。

- 综合 `backendAvailable` 与当前数据状态，返回布尔值。
- 供 `loadAll` 及其他数据加载点复用，避免判定逻辑散落。

### 5. `renderSourceTag()` / `renderDetail()` / `renderList()` / `renderMetrics()`

- `renderSourceTag`：标签渲染的具体 DOM 操作（部分版本中与 `updateSourceTag` 合并）。
- `renderDetail`：事件详情加载，后端可用时失败只提示、不静默降级。
- `renderList`：事件列表渲染，含空状态与行点击事件绑定。
- `renderMetrics`：指标卡片渲染，空值时显示 `--`。

## 四、联调与验证要点

1. **来源标签四态验证**：分别构造 `real_xdr`、`fixed_sample`、`fixed_sample_fallback`、`demo` 四种数据，确认标签文案准确切换（见 `test.md` 验证表格）。
2. **降级触发条件**：仅当列表与指标接口**同时失败**（如后端未启动、超时）时才使用 `demo-data.js`；单个接口异常不触发降级。
3. **Network 检查**：正常联调时确认**未加载** `demo-data.js`；只有后端完全不可用时才出现该请求。
4. **版本对齐**：前后端须分别处于约定的 Commit（`01b42e6` / `9b3a394`），截图证据需标注 `run_id` / `trace_id` 以追溯同一条运行链。

## 五、已知限制 / 后续事项

- 未接入真实数据
- 鉴权失败（401/403）当前为提示文案，尚未对接真实登录态跳转。
- 批量事件中若存在来源混合（真实 + 样例），标签以首条事件为准，可能与个体实际来源不一致，后续可改为逐行标注。



好的，以下是今天（2026-09-02）的 `development.md` 更新内容，仅包含 T0902 部分：

---

# T0902 开发说明

## 一、代码改动范围

### 1. `app.js`（前端核心逻辑）

- **trace_id / run_id 悬停显示**：在 `renderList()` 中为每个事件行的 trace_id 所在 `<div>` 添加 `title` 属性，值为完整 trace_id；在 `renderDetail()` 中为详情页顶部展示的 trace_id / run_id 元素添加 `title` 属性，鼠标悬停即可查看完整值。
- **审批联调完成**：`submitApproval` 函数已与后端 `POST /events/{id}/approval` 真实对接，返回 200 后刷新详情页，状态变更为 `COMPLETED`。
- **来源标签逻辑完善**：在 `updateSourceTag()` 中增加判断：当事件列表中同时存在 `sample_nature=fixed_sample` 和 `sample_nature=real_xdr`（或 `source=xdr`）时，右上角标签统一显示“真实数据”。判定顺序：优先检查是否存在 `real_xdr` 或 `xdr` 来源，若存在则显示“真实数据”；否则按首条事件判定。
- **修复来源标签显示**：之前 `renderSourceTag` 仅在首条事件为 `real_xdr` 时显示“真实 XDR 数据”，现在改为只要列表中存在 `xdr` 来源就显示“真实 XDR 数据”（与 T0828-04 设计一致）。

### 2. `styles.css`

- **无变更**：trace_id 悬停方案仅使用 `title` 属性，不修改 CSS 布局。

### 3. `demo-data.js`

- **无变更**：降级数据保持不变。

## 二、本地运行环境

### 前端（端口 8080）

```bash
python -m http.server 8080
```

启动后访问：http://localhost:8080

> 若 8080 端口被占用，可替换为其他端口（如 8081），并同步修改 `app.js` 中的 `API` 地址。

### 后端（远程服务器）

**今日联调使用远程后端**，无需本地启动后端服务。前端 `app.js` 中 API 基址已配置为：

```javascript
const API = 'http://124.221.234.124';
```

> 注意：该地址为公网 IP，无端口号（默认 80）。若需本地调试，可自行启动后端（见下方备选说明）。

**备选：本地启动后端（仅当需要本地调试时）**

```bash
.\venv311\Scripts\activate
uvicorn sec_agent.api.app:app --reload --app-dir src
```

启动成功后访问：http://localhost:8000  
交互式 API 文档（Swagger）：http://localhost:8000/docs

> 若使用本地后端，需同步修改 `app.js` 中的 `API` 为 `http://127.0.0.1:8000`。

### 关键版本

- 前端 Commit：`416df76`
- 后端：远程部署（IP `124.221.234.124`），对应后端 Commit 为 `0ea30c8`
- Python：3.11（仅本地调试时需要）

## 三、关键函数说明

### 1. `renderList()` — trace_id 悬停

在渲染事件列表的 trace_id 单元格时，除了设置文本内容外，额外设置 `title` 属性：

```javascript
// 伪代码示意
let traceDiv = document.createElement('div');
traceDiv.textContent = truncateTraceId(event.trace_id); // 显示截断值
traceDiv.title = event.trace_id;                         // 悬停显示完整值
```

### 2. `renderDetail()` — run_id 悬停

在详情页顶部展示 trace_id / run_id 的区域，同样添加 `title` 属性：

```javascript
document.getElementById('cur-trace').title = data.trace_id;
document.getElementById('detail-run-id').title = data.run_id;
```

### 3. `updateSourceTag()` — 多来源共存判定

新增逻辑：遍历 `events` 数组，若存在 `sample_nature === "real_xdr"` 或 `source === "xdr"` 的事件，则标签显示“真实 XDR 数据”；否则按首条事件判定。若同时存在 `fixed_sample` 和 `xdr`，仍然显示“真实 XDR 数据”。

### 4. `submitApproval()` — 审批联调

已通过真实接口 `POST /events/{id}/approval` 完成联调，请求体包含 `approved`、`approver`、`reason`、`idempotency_key`。响应 200 后调用 `refreshDetail()` 更新页面。

## 四、联调与验证要点

1. **trace_id 悬停验证**：鼠标悬浮在事件列表的 trace_id 列上，应出现完整 ID 的 tooltip。
2. **审批联调验证**：选择状态为 `APPROVAL_REQUIRED` 的事件，点击“审批”按钮，填写表单（`approved=true`, `approver=111`），提交后状态变为 `COMPLETED`，处置记录显示 `stateful_mock_containment`。
3. **来源标签验证**：后端返回的数据中包含 `source=xdr` 的事件时，右上角显示“真实 XDR 数据”；若同时存在 `fixed_sample` 和 `xdr`，仍显示“真实 XDR 数据”（按当前设计）。验收截图已确认该行为。
4. **Network 检查**：正常联调时应看到 4 个 GET 请求（events、events/{id}、timeline、metrics）+ 1 个 POST 请求（approval），均为 200。请求目标地址应为 `124.221.234.124`。
5. **截图验收**：10 张截图已全部截取，覆盖 commit、trace_id 悬停、来源标签、审批前后、Network、处置记录、无降级证据、边界文字。

## 五、已知限制 / 后续事项

| 优先级 | 事项 | 是否影响主链 | 负责人/完成条件 |
|---|---|---|---|
| P1 | trace_id 列未实现自动换行，仅靠悬停查看完整 ID | 否（体验优化） | 可考虑调整 Grid 列宽或使用 `text-overflow: ellipsis` + `title` 组合 |
| P1 | 当 `fixed_sample` 和 `xdr` 来源同时存在时，来源标签统一显示“真实数据”，可能让用户误以为全部为真实数据 | 否（当前设计如此） | 需与产品/验收方确认最终文案；如需精确区分，应改为逐行标注来源或在标签中增加数量说明 |





