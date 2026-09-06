/* ============================================================
 * 知识增强 A/B 评测展示 — eval/app.js
 * 数据优先级：后端接口 /eval/comparisons → 内置 MOCK_DATA（降级）
 * ============================================================ */
const API = window.__APP_CONFIG__ ? window.__APP_CONFIG__.API : "http://124.221.234.124";
const COMPARISON_URL = API.replace(/\/$/, "") + "/eval/comparisons";

let MOCK_DATA = [];

async function loadMockData() {
  try {
    // 修复路径：相对于 eval/index.html，mock 文件夹在上级目录
    const response = await fetch('../mock/eval-data.json');
    if (!response.ok) throw new Error("JSON文件加载失败");
    MOCK_DATA = await response.json();
    console.log('✅ Mock 数据加载成功，共', MOCK_DATA.length, '个案例');
  } catch (e) {
    console.error('❌ Mock 数据加载失败:', e);
    MOCK_DATA = [];
  }
}

/* ---------- 工具函数 ---------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function fmtTime(ms) {
  return ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : (ms || 0) + " ms";
}

/* 渲染来源 */
function renderSources(sources = []) {
  if (!sources || !sources.length) return el("span", { class: "k", text: "（未引用）" });
  const box = el("div", { class: "src-list" });
  sources.forEach(s => {
    const cls = s.kind === "event" ? "src-event" : s.kind === "tool" ? "src-tool" : "src-knowledge";
    const kindText = s.kind === "event" ? "事件证据" : s.kind === "tool" ? "工具证据" : "通用知识引用";
    box.appendChild(el("div", { class: `src-item ${cls}` }, [
      el("span", { class: "src-kind", text: kindText }),
      el("span", { text: `${s.id || ""} · ${s.label || ""}` })
    ]));
  });
  return box;
}

/* 渲染工具调用 */
function renderToolCalls(calls = []) {
  if (!calls || !calls.length) return el("span", { class: "k", text: "（未调用）" });
  const box = el("div");
  calls.forEach(tc => {
    const statusCls = `tool-status-${tc.status}`;
    const statusText = tc.status === "called" ? "已调用 ✓" : tc.status === "failed" ? "调用失败 ✗" : "未调用";
    box.appendChild(el("div", { class: "tool-call" }, [
      el("span", { class: `tool-name ${statusCls}`, text: `${tc.tool_name || ""} — ${statusText}` })
    ]));
  });
  return box;
}

/* 渲染单条场景 */
function renderScenario(s = {}, mode) {
  const col = el("div", { class: `col ${mode}` });
  col.appendChild(el("div", { class: "col-head" }, [
    el("span", { class: `dot ${mode}` }),
    el("span", { text: mode === "guarded" ? "GUARDED · 有知识增强" : "OFF · 无知识增强" })
  ]));

  // 防崩溃兜底处理
  const matchedIds = (s.matched_knowledge || []).map(k => k.id).filter(Boolean);
  
  const rows = [
    ["知识适用性", s.knowledge_applicability ? "✅ 命中" : "❌ 未命中"],
    ["命中知识 ID", matchedIds.length ? matchedIds.join(", ") : "—"],
    ["证据缺口", (s.evidence_gaps && s.evidence_gaps.length) ? "" : "无"]
  ];
  
  rows.forEach(([k, v]) => {
    const r = el("div", { class: "row" }, [el("span", { class: "k", text: k })]);
    if (k === "证据缺口" && s.evidence_gaps && s.evidence_gaps.length) {
      const ul = el("ul", { class: "gap-list" });
      s.evidence_gaps.forEach(g => ul.appendChild(el("li", { text: g })));
      r.appendChild(ul);
    } else {
      r.appendChild(el("span", { text: v }));
    }
    col.appendChild(r);
  });

  col.appendChild(el("div", { class: "row" }, [
    el("span", { class: "k", text: "知识/证据来源" }),
    renderSources(s.knowledge_sources)
  ]));

  col.appendChild(el("div", { class: "row" }, [
    el("span", { class: "k", text: "工具调用状态" }),
    renderToolCalls(s.tool_calls)
  ]));

  col.appendChild(el("div", { class: "row" }, [
    el("span", { class: "k", text: "最终结论" }),
    el("span", { text: s.conclusion_text || s.final_decision || "无" })
  ]));

  const btn = el("button", { class: "evidence-btn", text: "查看原始证据 / JSON" });
  btn.onclick = () => openEvidenceModal(s);
  col.appendChild(btn);
  return col;
}

/* 渲染案例卡片 */
function renderCase(caseData = {}) {
  const { case_id, event_id, summary, status, scenarios } = caseData;
  const card = el("div", { class: "case-card" });
  
  const head = el("div", { class: "case-head" }, [
    el("strong", { text: case_id || "未知ID" }),
    el("span", { class: "case-id", text: event_id || "" }),
    el("span", { class: `tag ${status === "FAILED" ? "tag-failed" : "tag-approval"}`, text: status || "PENDING" })
  ]);
  head.appendChild(el("span", { class: "case-summary", text: summary || "（无摘要）" }));
  card.appendChild(head);

  const compare = el("div", { class: "compare" });
  compare.appendChild(renderScenario(scenarios?.off, "off"));
  compare.appendChild(renderScenario(scenarios?.guarded, "guarded"));
  card.appendChild(compare);

  const g = scenarios?.guarded || {};
  const foot = el("div", { class: "case-foot" });
  foot.appendChild(el("span", { class: "stat-pill webshell", text: `🚫 WebShell拒: ${g.web_shell_rejected_count || 0}` }));
  foot.appendChild(el("span", { class: "stat-pill unsub", text: `⚠️ 无依据: ${g.unsubstantiated_statements_count || 0}` }));
  foot.appendChild(el("span", { class: "stat-pill human", text: g.human_intervention_required ? "👤 需人工" : "🤖 无需人工" }));
  foot.appendChild(el("span", { class: "stat-pill time", text: `⏱ OFF ${fmtTime(scenarios?.off?.processing_time_ms)} → GUARDED ${fmtTime(g.processing_time_ms)}` }));
  card.appendChild(foot);

  return card;
}

/* 渲染汇总 */
function renderSummary(cases = []) {
  let webshell = 0, unsub = 0, human = 0;
  cases.forEach(c => {
    const g = c.scenarios?.guarded || {};
    webshell += g.web_shell_rejected_count || 0;
    unsub += g.unsubstantiated_statements_count || 0;
    if (g.human_intervention_required) human++;
  });
  document.getElementById("sum-cases").textContent = cases.length;
  document.getElementById("sum-webshell").textContent = webshell;
  document.getElementById("sum-unsub").textContent = unsub;
  document.getElementById("sum-human").textContent = human;
}

/* 弹窗 */
function openEvidenceModal(scenario) {
  const modalBody = document.getElementById("modal-body");
  const modalMask = document.getElementById("modal-mask");
  if(modalBody) {
    modalBody.innerHTML = "";
    modalBody.appendChild(el("pre", { text: JSON.stringify(scenario, null, 2) }));
  }
  if(modalMask) modalMask.hidden = false;
}

/* ---------- 数据加载 ---------- */
async function jfetch(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn("[eval] 接口不可用，准备降级:", e.message);
    return null;
  }
}

async function loadData() {
  // 1. 先确保 Mock 数据加载完成
  await loadMockData();

  const dataSourceEl = document.getElementById("data-source");
  if(!dataSourceEl) {
    console.error("找不到 data-source 元素，请检查 HTML 结构！");
    return;
  }

  // 2. 尝试后端接口
  const remote = await jfetch(COMPARISON_URL);
  let data, source;
  
  if (Array.isArray(remote) && remote.length) {
    data = remote;
    source = `实时数据（${API}）`;
  } else {
    data = MOCK_DATA;
    source = "演示数据（前端降级 · 等待 fixture）";
  }
  dataSourceEl.textContent = "数据来源：" + source;

  const list = document.getElementById("case-list");
  list.innerHTML = "";
  
  if (!data || !data.length) {
    list.appendChild(el("p", { class: "placeholder", text: "暂无评测案例" }));
    return;
  }
  
  // 3. 渲染
  data.forEach(c => list.appendChild(renderCase(c)));
  renderSummary(data);
}

/* ---------- 启动 ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadData(); // 修复异步启动顺序
  
  const modalClose = document.getElementById("modal-close");
  const modalMask = document.getElementById("modal-mask");
  
  if(modalClose) modalClose.onclick = () => { if(modalMask) modalMask.hidden = true; };
  if(modalMask) modalMask.onclick = (e) => {
    if (e.target.id === "modal-mask") modalMask.hidden = true;
  };
});