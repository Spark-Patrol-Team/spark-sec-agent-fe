# 知识增强 A/B 评测展示页

## 启动方式
在项目根目录启动静态服务（注意：必须在根目录，以便 eval/ 可访问）：
```bash
cd spark-sec-agent-fe
python -m http.server 3000
```
浏览器访问：`http://localhost:3000/eval/index.html`

## API 地址
页面读取 `window.__APP_CONFIG__.API`，若不存在则默认 `http://124.221.234.124`。
- 联调公网：`http://124.221.234.124`（后端需实现 `GET /eval/comparisons`）
- 联调本地：在 `index.html` 顶部注入 `<script>window.__APP_CONFIG__={API:"http://127.0.0.1:8000"}</script>`

## 数据契约
后端 `GET /eval/comparisons` 返回数组，单条结构见 `app.js` 顶部 `MOCK_DATA`。
`knowledge_sources[].kind` 取值：`event`(事件证据) / `tool`(工具证据) / `knowledge`(通用知识引用)。

## 降级策略
接口不可用时自动使用内置 `MOCK_DATA`，右上角标注"演示数据"。
