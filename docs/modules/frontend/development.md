# 前端模块开发运行说明

## 一、实现方式

- **技术栈**：原生 HTML + CSS + JavaScript（ES6）
- **无第三方依赖**：不依赖 Node.js、npm、Webpack 等构建工具
- **数据层**：`app.js` 封装 `fetchData()` 函数，优先请求真实接口，失败后自动降级到 `demo-data.js`

## 二、文件结构

```
spark-sec-agent-fe/
├── index.html          # 主页面（双击即可打开）
├── app.js              # 核心逻辑（数据获取、渲染、审批交互）
├── demo-data.js        # 演示数据（人工构造，标注来源）
├── styles.css          # 样式文件
├── README.md           # 项目说明
├── assets/             # 静态资源（截图等，需脱敏）
├── docs/
│   └── modules/
│       └── frontend/
│           ├── design.md
│           ├── development.md
│           └── test.md
└── .gitignore
```

## 三、依赖

- **运行时**：现代浏览器（Chrome 90+ / Edge 90+ / Firefox 90+）
- **开发工具**：任意文本编辑器（VS Code 推荐）
- **版本控制**：Git

## 四、启动方法

### 方式一：直接打开（演示模式）

```bash
双击 index.html
```

浏览器打开后默认走演示数据，右上角显示"后端未启动，已自动降级"。

### 方式二：对接后端（真实模式）

1. 启动后端服务（李雨妍维护）：
   ```bash
   cd spark-sec-agent-be
   uvicorn sec_agent.main:app --reload --root-path src
   ```

2. 后端运行在 `http://localhost:8000`。

3. 刷新 `index.html`，页面自动请求真实接口。

## 五、调试方法

1. **打开浏览器开发者工具**（F12）。
2. **Console 面板**：查看数据请求日志和错误信息。
3. **Network 面板**：查看接口请求和响应详情。
4. **Sources 面板**：断点调试 `app.js` 中的渲染逻辑。

## 六、接口契约

| 接口路径 | 方法 | 请求参数 | 响应格式 |
|---|---|---|---|
| `/events` | GET | 无 | `EventListItem[]` |
| `/events/{event_id}` | GET | path param | `SecurityEvent` |
| `/events/{event_id}/timeline` | GET | path param | `TimelineEntry[]` |
| `/events/{event_id}/approval` | POST | `{approved, approver, reason, idempotency_key}` | `{"status": "ok"}` |
| `/metrics` | GET | 无 | `{"total_alerts", "processed", ...}` |

## 七、已知限制

1. 演示数据为静态 Mock，不具备动态更新能力。
2. 证据抽屉侧滑组件尚未实现。
3. 视觉风格尚未统一（配色、图标、字体待后续调整）。
