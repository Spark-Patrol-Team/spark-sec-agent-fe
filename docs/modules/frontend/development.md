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
