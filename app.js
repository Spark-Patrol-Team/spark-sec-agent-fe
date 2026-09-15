const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STATUS_LABELS = {
  RECEIVED: "已接收",
  CORRELATING: "关联中",
  TRIAGED: "已研判",
  INVESTIGATING: "调查中",
  DECISION_READY: "待决策",
  APPROVAL_REQUIRED: "待审批",
  EXECUTING: "执行中",
  VERIFYING: "验证中",
  COMPLETED: "已完成",
  HUMAN_REQUIRED: "需人工处理",
  FAILED: "失败",
};

const state = {
  mode: "api",
  apiBase: "",
  events: [],
  metrics: null,
  selectedId: null,
  evalPayload: null,
  eventError: null,
  evalError: null,
};

class RequestError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function cleanApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function initialApiBase() {
  const queryValue = new URLSearchParams(location.search).get("api");
  const savedValue = localStorage.getItem("sec-agent-api-base");
  const metaValue = document.querySelector('meta[name="api-base"]')?.content;
  return cleanApiBase(queryValue || savedValue || metaValue || "http://127.0.0.1:8000");
}

async function requestJson(path, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${state.apiBase}${path}`, { ...options, signal: controller.signal });
    const raw = await response.text();
    let payload = null;
    if (raw) {
      try { payload = JSON.parse(raw); } catch { payload = raw; }
    }
    if (!response.ok) {
      const detail = payload && typeof payload === "object" ? payload.detail : payload;
      throw new RequestError(detail || `接口返回 ${response.status}`, response.status);
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new RequestError("请求超时，请检查后端地址或网络");
    if (error instanceof RequestError) throw error;
    throw new RequestError("无法连接后端，请检查地址、服务状态和 CORS 配置");
  } finally {
    clearTimeout(timer);
  }
}

function setConnection(kind, text) {
  const element = $("#connection-state");
  element.className = `connection-state is-${kind}`;
  element.textContent = text;
}

function setProvenance(target, kind, label, detail) {
  const element = $(target);
  element.className = `provenance-banner${kind ? ` is-${kind}` : ""}`;
  element.innerHTML = `<span class="provenance-dot" aria-hidden="true"></span><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span>`;
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast is-visible${isError ? " is-error" : ""}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = "toast"; }, 3600);
}

function setBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

function statusTone(status) {
  if (status === "COMPLETED") return "success";
  if (["CORRELATING", "TRIAGED", "INVESTIGATING", "DECISION_READY", "EXECUTING", "VERIFYING"].includes(status)) return "progress";
  if (status === "APPROVAL_REQUIRED") return "warning";
  if (["FAILED", "HUMAN_REQUIRED"].includes(status)) return "danger";
  return "neutral";
}

function sourceLabel(source, forceDemo = false) {
  if (forceDemo || state.mode === "demo") return "脱敏演示样例（Mock）";
  const effective = source?.effective_source || source?.effective || source?.source || source;
  const fallback = source?.fallback_source || source?.fallback;
  if (fallback) return `回退数据：${fallback}`;
  if (effective === "xdr_openapi" || effective === "xdr") return "真实 XDR 输入";
  if (effective === "fixed_sample") return "固定样例";
  if (effective === "jsonl_sample") return "JSONL 样例";
  return effective || "来源未标记";
}

function formatTime(value) {
  if (!value) return "时间未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function eventTitle(event) {
  return event.title || event.overview?.title || event.summary || event.event_summary?.summary || event.event_id;
}

function eventListItemFromDemo(event) {
  return {
    event_id: event.event_id,
    run_id: event.run_id,
    trace_id: event.trace_id,
    status: event.status,
    status_label: STATUS_LABELS[event.status],
    source: "mock_fixture",
    requested_source: "fixed_sample",
    effective_source: "fixed_sample",
    fallback_source: null,
    alert_count: event.event_summary?.alert_count_before || event.alert_refs?.length || 0,
    risk_score: event.triage?.risk_score ?? null,
    priority: event.triage?.priority ?? null,
    verdict: event.triage?.verdict ?? null,
    updated_at: event.timeline?.at(-1)?.at,
    summary: event.summary || event.event_summary?.summary,
  };
}

function demoDetail(event) {
  const investigation = event.investigation;
  const response = event.response;
  return {
    schema_version: "demo.mock.v1",
    event_id: event.event_id,
    run_id: event.run_id,
    trace_id: event.trace_id,
    status: event.status,
    status_label: STATUS_LABELS[event.status] || event.status,
    source: { requested: "fixed_sample", effective: "fixed_sample", fallback: null, sample_id: "frontend-demo", xdr_event_id: null },
    overview: {
      title: eventTitle(event),
      summary: event.summary || event.event_summary?.summary,
      alert_count: event.event_summary?.alert_count_before || event.alert_refs?.length || 0,
      risk_score: event.triage?.risk_score ?? null,
      priority: event.triage?.priority ?? null,
      verdict: event.triage?.verdict ?? null,
      confidence: event.triage?.confidence ?? null,
      needs_human: event.status === "HUMAN_REQUIRED" || Boolean(investigation?.needs_human),
      affected_assets: event.event_summary?.entities?.assets || [],
      source_ips: event.event_summary?.entities?.src_ips || [],
      destination_ips: event.event_summary?.entities?.dst_ips || [],
    },
    timeline: event.timeline || [],
    errors: event.errors || [],
    investigation: investigation ? {
      conclusion: investigation.conclusion,
      final_confidence: investigation.final_confidence,
      summary: investigation.summary,
      affected_objects: investigation.affected_objects || [],
      unresolved_questions: investigation.unresolved_questions || [],
      recommended_actions: investigation.recommended_actions || [],
      key_evidence_refs: investigation.key_evidence_refs || [],
      evidence_sources: ["mock_fixture"],
      manual_takeover_reason: investigation.needs_human ? "脱敏样例要求人工复核" : null,
      tool_result_count: investigation.steps?.length || 0,
    } : null,
    response: response ? {
      action: response.plan?.action,
      target: response.plan?.target,
      risk_level: response.plan?.risk_level,
      evidence_scope: response.plan ? "STRONG_EVIDENCE" : null,
      max_allowed_risk_level: response.plan?.risk_level,
      approval_required: response.plan?.approval_required,
      execution_status: response.execution?.platform_status || null,
      execution_effect_layer: response.execution ? "PLATFORM_RECORD" : null,
      verification_status: response.verification?.status || null,
      verification_effect_layer: response.verification ? "PLATFORM_RECORD" : null,
      final_status: response.verification?.final_status || null,
    } : null,
  };
}

function renderMetrics() {
  const metrics = state.metrics || {};
  $("#metric-total").textContent = metrics.total_events ?? "—";
  $("#metric-completed").textContent = metrics.completed_events ?? "—";
  $("#metric-human").textContent = metrics.human_required_events ?? "—";
  $("#metric-failed").textContent = metrics.failed_events ?? "—";
}

function renderEventList() {
  const container = $("#event-list");
  const query = $("#event-filter").value.trim().toLowerCase();
  const visible = state.events.filter((event) => [event.event_id, event.status, event.status_label, event.source, event.effective_source, event.summary]
    .some((value) => String(value || "").toLowerCase().includes(query)));
  $("#event-count-label").textContent = state.eventError ? "接口加载失败" : `共 ${visible.length} 条${query ? "匹配结果" : "事件"}`;

  if (state.eventError) {
    container.innerHTML = `<div class="error-state"><h2>事件接口不可用</h2><p>${escapeHtml(state.eventError)}</p><button class="button button-secondary" type="button" data-action="retry-events">重新连接</button></div>`;
    return;
  }
  if (!visible.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-symbol" aria-hidden="true"></div><h2>${query ? "没有匹配事件" : "暂无事件"}</h2><p>${query ? "调整关键词后重试。" : "可运行固定样例生成一条可复现事件。"}</p></div>`;
    return;
  }
  container.innerHTML = visible.map((event) => {
    const selected = event.event_id === state.selectedId;
    const title = eventTitle(event);
    return `<button class="event-row${selected ? " is-selected" : ""}" type="button" data-event-id="${escapeHtml(event.event_id)}" aria-pressed="${selected}">
      <span class="event-row-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
      <span class="badge badge-${statusTone(event.status)}">${escapeHtml(event.status_label || STATUS_LABELS[event.status] || event.status)}</span>
      <span class="event-row-summary">${escapeHtml(event.summary || "暂无事件摘要")}</span>
      <span class="event-row-meta">
        <span>${escapeHtml(sourceLabel(event))}</span>
        <span>风险 ${event.risk_score ?? "—"}</span>
        <span>${escapeHtml(formatTime(event.updated_at))}</span>
      </span>
    </button>`;
  }).join("");
}

function listHtml(values, emptyText = "无") {
  const items = (values || []).filter(Boolean);
  if (!items.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function tokenList(values) {
  const items = (values || []).filter(Boolean);
  return items.length ? `<ul class="token-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
}

function responseBoundary(detail) {
  const response = detail.response || {};
  const status = detail.status;
  const action = response.action ? `${response.action}${response.target ? ` · ${response.target}` : ""}` : "未生成处置建议";
  const approval = response.approval_required
    ? (status === "APPROVAL_REQUIRED" ? "等待人工审批" : "审批状态已推进")
    : "未要求审批";
  const execution = response.execution_status
    ? `${response.execution_status}${response.execution_effect_layer ? ` · ${response.execution_effect_layer}` : ""}`
    : "没有平台受理记录";
  const deviceConfirmed = response.verification_effect_layer === "DEVICE_EFFECT" && response.final_status === "COMPLETED";
  const verification = deviceConfirmed ? "真实设备效果已验证" : "未取得真实设备效果证据";
  return `<div class="boundary-flow">
    <div class="boundary-step${response.action ? " is-confirmed" : ""}"><span>处置建议</span><strong>${escapeHtml(action)}</strong></div>
    <div class="boundary-step${status === "APPROVAL_REQUIRED" ? " is-pending" : ""}"><span>人工审批</span><strong>${escapeHtml(approval)}</strong></div>
    <div class="boundary-step${response.execution_status ? " is-confirmed" : ""}"><span>平台受理</span><strong>${escapeHtml(execution)}</strong></div>
    <div class="boundary-step${deviceConfirmed ? " is-confirmed" : " is-pending"}"><span>设备效果</span><strong>${escapeHtml(verification)}</strong></div>
  </div>`;
}

function renderEventDetail(detail) {
  const panel = $("#event-detail-panel");
  const overview = detail.overview || {};
  const investigation = detail.investigation;
  const source = detail.source || {};
  const canApprove = state.mode === "api" && detail.status === "APPROVAL_REQUIRED";
  const sourceKind = sourceLabel(source);
  const sourceExtra = source.fallback ? `；已从 ${source.requested || "原请求"} 回退` : "";

  panel.innerHTML = `<div class="detail-heading">
    <div>
      <h2 id="event-detail-title">${escapeHtml(overview.title || detail.event_id)}</h2>
      <p>${escapeHtml(overview.summary || "暂无事件摘要")}</p>
      <div class="detail-meta"><span>event ${escapeHtml(detail.event_id)}</span><span>trace ${escapeHtml(detail.trace_id || "—")}</span><span>${escapeHtml(sourceKind + sourceExtra)}</span></div>
    </div>
    <div class="detail-actions">
      <span class="badge badge-${statusTone(detail.status)}">${escapeHtml(detail.status_label || STATUS_LABELS[detail.status] || detail.status)}</span>
      ${canApprove ? `<button class="button button-danger" type="button" data-action="approve" data-event-id="${escapeHtml(detail.event_id)}">人工审批</button>` : ""}
    </div>
  </div>

  <div class="detail-grid">
    <div class="detail-stat"><span>研判结论</span><strong>${escapeHtml(overview.verdict || investigation?.conclusion || "未形成")}</strong></div>
    <div class="detail-stat"><span>风险分 / 优先级</span><strong>${overview.risk_score ?? "—"} / ${escapeHtml(overview.priority || "—")}</strong></div>
    <div class="detail-stat"><span>置信度</span><strong>${overview.confidence != null ? `${Math.round(overview.confidence * 100)}%` : "—"}</strong></div>
    <div class="detail-stat"><span>人工接管</span><strong>${overview.needs_human || investigation?.manual_takeover_reason ? "需要" : "未触发"}</strong></div>
  </div>

  <section class="detail-section">
    <h3>事件范围</h3>
    <div class="detail-section-copy"><strong>数据来源：</strong>${escapeHtml(sourceKind)}${escapeHtml(sourceExtra)}</div>
    ${tokenList([...(overview.affected_assets || []), ...(overview.source_ips || []), ...(overview.destination_ips || [])])}
  </section>

  <section class="detail-section">
    <h3>调查结论与证据</h3>
    <div class="detail-section-copy">${escapeHtml(investigation?.summary || "尚无调查报告。")}</div>
    ${investigation?.manual_takeover_reason ? `<div class="detail-section-copy"><strong>人工接管原因：</strong>${escapeHtml(investigation.manual_takeover_reason)}</div>` : ""}
    <div class="evidence-groups">
      <div class="evidence-group"><h4>当前事件证据引用</h4>${listHtml(investigation?.key_evidence_refs, "没有可展示的事件证据引用")}</div>
      <div class="evidence-group"><h4>证据来源记录</h4>${listHtml(investigation?.evidence_sources, "没有可展示的来源记录")}</div>
      <div class="evidence-group"><h4>待补证据</h4>${listHtml(investigation?.unresolved_questions, "没有登记未解决问题")}</div>
      <div class="evidence-group"><h4>建议动作</h4>${listHtml(investigation?.recommended_actions, "没有生成建议动作")}</div>
    </div>
  </section>

  <section class="detail-section"><h3>处置边界</h3>${responseBoundary(detail)}</section>

  <section class="detail-section">
    <h3>可审计时间线</h3>
    ${(detail.timeline || []).length ? `<ol class="timeline">${detail.timeline.map((item) => `<li><strong>${escapeHtml(item.status_label || STATUS_LABELS[item.status] || item.status)}</strong> · ${escapeHtml(item.message || "")}<time>${escapeHtml(formatTime(item.at))}${item.elapsed_ms != null ? ` · ${item.elapsed_ms} ms` : ""}</time></li>`).join("")}</ol>` : `<div class="detail-section-copy">没有时间线数据。</div>`}
  </section>
  ${detail.errors?.length ? `<section class="detail-section"><h3>异常记录</h3><div class="evidence-group">${listHtml(detail.errors.map((item) => `${item.stage}: ${item.message}`))}</div></section>` : ""}`;
}

async function selectEvent(eventId) {
  state.selectedId = eventId;
  renderEventList();
  const panel = $("#event-detail-panel");
  panel.innerHTML = `<div class="loading-state"><p>正在加载事件详情</p></div>`;
  try {
    const detail = state.mode === "demo"
      ? demoDetail(window.DEMO_EVENTS.find((item) => item.event_id === eventId))
      : await requestJson(`/events/${encodeURIComponent(eventId)}/view`);
    renderEventDetail(detail);
  } catch (error) {
    panel.innerHTML = `<div class="error-state"><h2>详情加载失败</h2><p>${escapeHtml(error.message)}</p><button class="button button-secondary" type="button" data-action="retry-detail" data-event-id="${escapeHtml(eventId)}">重试</button></div>`;
  }
}

async function loadApiEvents() {
  state.mode = "api";
  state.eventError = null;
  state.events = [];
  state.metrics = null;
  renderMetrics();
  $("#event-list").innerHTML = `<div class="loading-state"><p>正在连接事件与指标接口</p></div>`;
  setConnection("loading", "正在连接");
  setProvenance("#events-provenance", "", "数据状态：", "正在读取后端接口");
  $("#start-sample-button").disabled = true;

  const [healthResult, eventsResult, metricsResult] = await Promise.allSettled([
    requestJson("/health", {}, 8000),
    requestJson("/events"),
    requestJson("/metrics"),
  ]);

  const healthOk = healthResult.status === "fulfilled" && healthResult.value?.status === "ok";
  if (eventsResult.status === "fulfilled") state.events = Array.isArray(eventsResult.value) ? eventsResult.value : [];
  else state.eventError = eventsResult.reason?.message || "事件接口加载失败";
  if (metricsResult.status === "fulfilled") state.metrics = metricsResult.value;

  renderMetrics();
  renderEventList();
  $("#start-sample-button").disabled = !healthOk;

  if (healthOk && !state.eventError && metricsResult.status === "fulfilled") {
    setConnection("online", "后端已连接");
    setProvenance("#events-provenance", "", "数据状态：", "来自当前后端接口；每条事件继续按 effective_source 区分真实 XDR、固定样例与回退数据");
  } else if (healthOk) {
    setConnection("error", "后端在线，数据接口异常");
    const parts = [state.eventError, metricsResult.status === "rejected" ? `指标：${metricsResult.reason.message}` : ""].filter(Boolean);
    setProvenance("#events-provenance", "error", "接口异常：", parts.join("；"));
  } else {
    const message = healthResult.reason?.message || "健康检查未通过";
    setConnection("error", "连接失败");
    setProvenance("#events-provenance", "error", "连接失败：", message);
  }

  if (!state.eventError && state.events.length) await selectEvent(state.events[0].event_id);
}

function activateDemo() {
  state.mode = "demo";
  state.eventError = null;
  state.evalError = null;
  state.events = window.DEMO_EVENTS.map(eventListItemFromDemo);
  state.metrics = window.DEMO_METRICS;
  state.evalPayload = window.DEMO_EVAL;
  setConnection("demo", "脱敏样例模式");
  setProvenance("#events-provenance", "demo", "演示数据：", "前端内置脱敏 Mock，只用于离线展示，不代表真实 XDR、MCP 或最终服务器运行结果");
  $("#start-sample-button").disabled = true;
  renderMetrics();
  renderEventList();
  renderEval();
  if (state.events.length) selectEvent(state.events[0].event_id);
  showToast("已切换到脱敏样例模式");
}

async function startFixedSample() {
  if (state.mode !== "api") return;
  const button = $("#start-sample-button");
  setBusy(button, true, "正在运行…");
  try {
    const result = await requestJson("/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "fixed_sample" }),
    }, 30000);
    showToast("固定样例已进入主链；它不是实时 XDR 数据");
    await loadApiEvents();
    if (result?.event_id) await selectEvent(result.event_id);
  } catch (error) {
    showToast(`固定样例运行失败：${error.message}`, true);
  } finally {
    setBusy(button, false);
  }
}

function winnerClass(winner) {
  const normalized = String(winner || "").toUpperCase();
  if (normalized === "GUARDED") return "winner-guarded";
  if (normalized === "OFF") return "winner-off";
  return "winner-tie";
}

function normalizedApplicability(value) {
  return String(value || "").trim().toLowerCase();
}

function applicabilityLabel(value) {
  const normalized = normalizedApplicability(value);
  if (normalized === "applicable" || normalized === "in_scope") return "明确适用";
  if (normalized === "partially_applicable" || normalized === "weak_signal") return "弱信号 / 证据不足";
  if (normalized === "not_applicable" || normalized === "out_of_scope") return "域外 / 不适用";
  return value || "未记录";
}

function knowledgeIds(item) {
  return Array.isArray(item?.guarded?.matched_knowledge_ids)
    ? item.guarded.matched_knowledge_ids.filter(Boolean)
    : [];
}

function qualityLabel(winner) {
  const normalized = String(winner || "").toUpperCase();
  if (normalized === "GUARDED") return "GUARDED较高";
  if (normalized === "OFF") return "OFF较高";
  if (normalized === "TIE") return "同分";
  return "待复核";
}

function evaluationMeaning(item) {
  const applicability = normalizedApplicability(item.applicability || item.knowledge_mode);
  const ids = knowledgeIds(item);
  const comparison = item.comparison || { winner: item.winner, reason: item.reason };
  const winner = String(comparison.winner || "").toUpperCase();
  const reason = String(comparison.reason || "");

  if (applicability === "applicable" && ids.length && winner === "GUARDED") {
    return { kind: "knowledge", label: "明确知识增益", detail: "命中相关知识，并形成可追溯引用" };
  }
  if (/解析失败|解析问题/.test(reason)) {
    return { kind: "stability", label: "历史结果差异", detail: "保留原始评分，不作为最新质量效果结论" };
  }
  if (winner === "OFF") {
    return { kind: "regression", label: "旧版回归", detail: "保留历史评分，修复后结果不追溯改写" };
  }
  return { kind: "neutral", label: "无明确知识增益", detail: "两组质量接近或知识受边界限制" };
}

function gateSummary(results) {
  const applicable = results.filter((item) => normalizedApplicability(item.applicability || item.knowledge_mode) === "applicable");
  const weak = results.filter((item) => ["partially_applicable", "weak_signal"].includes(normalizedApplicability(item.applicability || item.knowledge_mode)));
  const outOfScope = results.filter((item) => ["not_applicable", "out_of_scope"].includes(normalizedApplicability(item.applicability || item.knowledge_mode)));
  const applicablePassed = applicable.filter((item) => knowledgeIds(item).length > 0).length;
  const weakPassed = weak.filter((item) => knowledgeIds(item).length === 0 && String(item.guarded?.verdict || "").toLowerCase() !== "malicious").length;
  const outOfScopePassed = outOfScope.filter((item) => knowledgeIds(item).length === 0).length;
  return {
    applicable,
    weak,
    outOfScope,
    applicablePassed,
    weakPassed,
    outOfScopePassed,
    totalPassed: applicablePassed + weakPassed + outOfScopePassed,
  };
}

function renderEval() {
  const summaryContainer = $("#eval-summary");
  const contextContainer = $("#eval-context");
  const resultsContainer = $("#eval-results");
  if (state.evalError) {
    summaryContainer.innerHTML = "";
    contextContainer.innerHTML = "";
    resultsContainer.innerHTML = `<div class="error-state"><h2>评测接口不可用</h2><p>${escapeHtml(state.evalError)}</p><button class="button button-secondary" type="button" data-action="retry-eval">重新加载</button></div>`;
    setProvenance("#eval-provenance", "error", "接口异常：", state.evalError);
    return;
  }
  const payload = state.evalPayload;
  if (!payload) {
    summaryContainer.innerHTML = "";
    contextContainer.innerHTML = "";
    resultsContainer.innerHTML = `<div class="empty-state"><div class="empty-symbol" aria-hidden="true"></div><h2>尚未加载评测</h2><p>连接后端或切换到脱敏样例模式。</p></div>`;
    return;
  }
  const summary = payload.summary || {};
  const results = payload.results || [];
  const gate = gateSummary(results);
  summaryContainer.innerHTML = [
    ["门禁行为符合预期", `${gate.totalPassed}/${results.length || summary.total_cases || "—"}`],
    ["适用场景知识命中", `${gate.applicablePassed}/${gate.applicable.length || "—"}`],
    ["弱信号未错误升级", `${gate.weakPassed}/${gate.weak.length || "—"}`],
    ["域外未释放知识", `${gate.outOfScopePassed}/${gate.outOfScope.length || "—"}`],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value ?? "—"}</strong></div>`).join("");

  contextContainer.innerHTML = `<div class="eval-context-primary">
    <strong>本批结论</strong>
    <p>门禁重点不是“多引用知识”，而是只在证据与场景匹配时释放知识。明确知识增益出现在 ${gate.applicablePassed}/${gate.applicable.length || "—"} 个适用案例。</p>
  </div>
  <div class="eval-context-secondary">
    <strong>10案门禁复核</strong>
    <p>GUARDED较高 ${summary.guarded_wins ?? "—"} · OFF较高 ${summary.off_wins ?? "—"} · 同分 ${summary.ties ?? "—"}。本组数据用于核对知识门禁边界，最新质量效果以上方受控测试为准。</p>
  </div>`;

  resultsContainer.innerHTML = `<table class="eval-table">
    <thead><tr><th>案例</th><th>适用边界</th><th>OFF</th><th>GUARDED</th><th>评测解释</th><th>主要依据</th></tr></thead>
    <tbody>${results.map((item) => {
      const comparison = item.comparison || { winner: item.winner, reason: item.reason };
      const off = item.off || {};
      const guarded = item.guarded || {};
      const ids = knowledgeIds(item);
      const winner = comparison.winner ? String(comparison.winner).toUpperCase() : "待复核";
      const meaning = evaluationMeaning(item);
      return `<tr>
        <td><strong>${escapeHtml(item.case_id)}</strong></td>
        <td>${escapeHtml(applicabilityLabel(item.applicability || item.knowledge_mode))}</td>
        <td>${escapeHtml(off.verdict || "—")} · ${off.confidence != null ? `${Math.round(off.confidence * 100)}%` : "—"}</td>
        <td>${escapeHtml(guarded.verdict || "—")} · ${guarded.confidence != null ? `${Math.round(guarded.confidence * 100)}%` : "—"}<div class="knowledge-ids">${escapeHtml(ids.join(" · ") || "无知识引用")}</div></td>
        <td><span class="meaning meaning-${meaning.kind}">${escapeHtml(meaning.label)}</span><span class="meaning-detail">${escapeHtml(meaning.detail)}</span><span class="quality-outcome ${winnerClass(winner)}">旧质量：${escapeHtml(qualityLabel(winner))}</span></td>
        <td>${escapeHtml(comparison.reason || "尚无人工复核说明")}</td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;

  if (payload.data_source === "actual") {
    const commit = payload.run_metadata?.run_commit ? `；运行 Commit ${payload.run_metadata.run_commit}` : "；运行 Commit 未记录";
    setProvenance("#eval-provenance", "", "正式结果包：", `后端返回 data_source=actual${commit}`);
  } else if (payload.data_source === "review_snapshot") {
    setProvenance("#eval-provenance", "demo", "复核摘要：", "项目组人工评分表的脱敏静态摘要，不是在线接口返回，也不包含原始平台报告");
  } else {
    setProvenance("#eval-provenance", "demo", "后端 Mock：", "data_source=mock_fixture，仅用于接口联调，不代表正式 A/B 结果");
  }
}

async function loadEval() {
  if (state.mode === "demo") {
    state.evalPayload = window.DEMO_EVAL;
    state.evalError = null;
    renderEval();
    return;
  }
  state.evalPayload = null;
  state.evalError = null;
  $("#eval-summary").innerHTML = "";
  $("#eval-context").innerHTML = "";
  $("#eval-results").innerHTML = `<div class="loading-state"><p>正在加载评测结果</p></div>`;
  try {
    state.evalPayload = await requestJson("/eval/comparisons", {}, 20000);
  } catch (error) {
    state.evalError = error.message;
  }
  renderEval();
}

function setTab(tabName) {
  const isEvents = tabName === "events";
  $("#events-tab").classList.toggle("is-active", isEvents);
  $("#events-tab").setAttribute("aria-selected", String(isEvents));
  $("#eval-tab").classList.toggle("is-active", !isEvents);
  $("#eval-tab").setAttribute("aria-selected", String(!isEvents));
  $("#events-page").classList.toggle("is-active", isEvents);
  $("#events-page").hidden = !isEvents;
  $("#eval-page").classList.toggle("is-active", !isEvents);
  $("#eval-page").hidden = isEvents;
  if (!isEvents) loadEval();
}

function openApproval(eventId) {
  if (state.mode !== "api") {
    showToast("脱敏样例模式不会模拟审批生效", true);
    return;
  }
  $("#approval-event-id").value = eventId;
  $("#approval-decision").value = "";
  $("#approval-person").value = "";
  $("#approval-reason").value = "";
  $("#approval-dialog").showModal();
}

async function submitApproval(event) {
  event.preventDefault();
  const button = $("#submit-approval-button");
  const eventId = $("#approval-event-id").value;
  const body = {
    approved: $("#approval-decision").value === "true",
    approver: $("#approval-person").value.trim(),
    reason: $("#approval-reason").value.trim(),
    idempotency_key: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
  setBusy(button, true, "正在提交…");
  try {
    await requestJson(`/events/${encodeURIComponent(eventId)}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 20000);
    $("#approval-dialog").close();
    showToast("审批已由后端受理；设备效果仍以独立验证证据为准");
    await loadApiEvents();
    await selectEvent(eventId);
  } catch (error) {
    showToast(`审批未提交、未生效：${error.message}`, true);
  } finally {
    setBusy(button, false);
  }
}

function bindEvents() {
  $("#connect-button").addEventListener("click", () => {
    const apiBase = cleanApiBase($("#api-base").value);
    if (!/^https?:\/\//i.test(apiBase)) {
      showToast("请输入以 http:// 或 https:// 开头的 API 地址", true);
      return;
    }
    state.apiBase = apiBase;
    localStorage.setItem("sec-agent-api-base", apiBase);
    loadApiEvents();
  });
  $("#api-base").addEventListener("keydown", (event) => {
    if (event.key === "Enter") $("#connect-button").click();
  });
  $("#demo-button").addEventListener("click", activateDemo);
  $("#start-sample-button").addEventListener("click", startFixedSample);
  $("#refresh-events-button").addEventListener("click", () => state.mode === "demo" ? activateDemo() : loadApiEvents());
  $("#refresh-eval-button").addEventListener("click", loadEval);
  $("#event-filter").addEventListener("input", renderEventList);
  $("#events-tab").addEventListener("click", () => setTab("events"));
  $("#eval-tab").addEventListener("click", () => setTab("eval"));
  $("#event-list").addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "retry-events") return loadApiEvents();
    const row = event.target.closest("[data-event-id]");
    if (row) selectEvent(row.dataset.eventId);
  });
  $("#event-detail-panel").addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    if (target.dataset.action === "approve") openApproval(target.dataset.eventId);
    if (target.dataset.action === "retry-detail") selectEvent(target.dataset.eventId);
  });
  $("#eval-results").addEventListener("click", (event) => {
    if (event.target.closest('[data-action="retry-eval"]')) loadEval();
  });
  $("#close-approval-button").addEventListener("click", () => $("#approval-dialog").close());
  $("#cancel-approval-button").addEventListener("click", () => $("#approval-dialog").close());
  $("#approval-form").addEventListener("submit", submitApproval);
}

function init() {
  state.apiBase = initialApiBase();
  $("#api-base").value = state.apiBase;
  bindEvents();
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") {
    activateDemo();
  } else {
    loadApiEvents();
  }
  if (params.get("tab") === "eval") setTab("eval");
}

init();
