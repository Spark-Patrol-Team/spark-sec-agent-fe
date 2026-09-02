// app.js
// 严格对照李雨妍仓库接口基线：
// POST /runs (source, sample_id) -> 启动
// GET  /events -> list[EventListItem]
// GET  /events/{event_id} -> EventContext
// GET  /events/{event_id}/timeline -> list[TimelineEntry]
// POST /events/{event_id}/approval -> ApprovalDecision {approved,approver,reason,idempotency_key}
// GET  /metrics -> {total_events,completed_events,human_required_events,failed_events,note}
const API = 'http://124.221.234.124';
const $ = (s)=>document.querySelector(s);
const escapeHtml = (s)=> String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const statusClass = (st)=>({COMPLETED:"b-completed",INVESTIGATING:"b-investigating",APPROVAL_REQUIRED:"b-approval",FAILED:"b-failed",HUMAN_REQUIRED:"b-human"}[st]||"");
const dotColor = (st)=>({done:"#22c55e",doing:"#eab308",failed:"#ef4444",pending:"#94a3b8"}[st]||"#94a3b8");

let events = []; let metrics = null; let usingDemo = false;
let backendAvailable = false; // 新增：标记后端是否曾经成功响应过

// ===== 改动点1：增加超时控制的 jfetch 函数 =====
async function jfetch(url, timeoutMs = 10000){
  try{
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if(!r.ok) throw new Error(r.status);
    return await r.json();
  }catch(e){ 
    // 超时错误特殊处理
    if (e.name === 'AbortError') {
      console.warn('请求超时:', url);
    }
    return null; 
  }
}
// ===== 改动点1结束 =====

function uuid(){ return crypto.randomUUID? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==="x"?r:(r&0x3|0x8)).toString(16);}); }

// ===== 改动点2：修复 loadAll 降级逻辑 =====
async function loadAll(){
  // 重置标志
  backendAvailable = false;
  usingDemo = false;

  // 列表：仅当请求失败（返回 null）时才降级，否则使用后端数据（包括空数组）
  let list = await jfetch(API+"/events");
  if(list !== null){
    backendAvailable = true;
    events = list;
  } else {
    // 列表失败，先不降级，等 metrics 结果
    events = [];
  }

  // 指标：同样仅当请求失败时降级
  let m = await jfetch(API+"/metrics");
  if(m !== null){
    backendAvailable = true;
    metrics = m;
  } else {
    metrics = null;
  }

  // 如果两次都失败，才降级到演示数据
  if (!backendAvailable) {
    list = window.DEMO_EVENTS.map(e=>({event_id:e.event_id,run_id:e.run_id,trace_id:e.trace_id,status:e.status,source:e.source,summary:e.summary}));
    events = list;
    renderList();
    m = window.DEMO_METRICS;
    metrics = m;
    renderMetrics();
    usingDemo = true;
  } else {
    // 后端可用，但列表可能为空（空数组）
    renderList();
    renderMetrics();
    usingDemo = false;
  }

  // 更新来源标签（动态判断）
  updateSourceTag();
}
// ===== 改动点2结束 =====

// ===== 改动点3：来源标签动态化 =====
function updateSourceTag() {
  const sourceTag = $("#source-tag");
  if(!sourceTag) return;

  // 1. 前端演示数据（降级）
  if (usingDemo) {
    sourceTag.textContent = "数据来源：演示数据（前端降级）";
    return;
  }

  // 2. 后端可用，遍历所有事件判断来源
  if (!events || events.length === 0) {
    sourceTag.textContent = "数据来源：暂无事件数据";
    return;
  }

  // 遍历列表，检查是否有真实数据
  const hasRealXdr = events.some(ev => {
    const nature = ev.sample_nature || ev.source || "";
    return nature === "real_xdr" || nature === "xdr";
  });

  if (hasRealXdr) {
    sourceTag.textContent = "数据来源：真实 XDR 数据";
    return;
  }

  // 没有真实数据，按第一条事件的来源显示
  const firstNature = events[0].sample_nature || events[0].source || "";
  switch (firstNature) {
    case "fixed_sample":
      sourceTag.textContent = "数据来源：固定样例";
      break;
    case "fixed_sample_fallback":
      sourceTag.textContent = "数据来源：固定样例（回退）";
      break;
    case "demo":
      sourceTag.textContent = "数据来源：演示数据";
      break;
    default:
      sourceTag.textContent = "数据来源：" + escapeHtml(firstNature);
      break;
  }
}
// ===== 改动点3结束 =====

function renderList(){
  const c = $("#event-list"); 
  if(!c) return;
  c.innerHTML="";

  // 空结果处理
  if (!events || events.length === 0) {
    c.innerHTML = '<div class="empty-state">暂无事件数据</div>';
    return;
  }

  events.forEach(ev=>{
    const row = document.createElement("div"); row.className="event-row";
    row.dataset.id = ev.event_id; // 修复：添加 data-id 属性
    row.innerHTML = `
      <div>${escapeHtml(ev.event_id)}</div>
      <div style="font-size:10px;color:#94a3b8;" title="${escapeHtml(ev.trace_id||"")}">${escapeHtml((ev.trace_id||"").slice(0,10))}…</div>
      <div><span class="badge ${statusClass(ev.status)}">${escapeHtml(ev.status)}</span></div>
      <div>${escapeHtml(ev.source||"")}</div>
      <div style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(ev.summary||"")}">${escapeHtml(ev.summary||"")}</div>
      <div>${ev.status==="APPROVAL_REQUIRED"? '<button class="btn btn-danger" data-approve="'+escapeHtml(ev.event_id)+'">审批</button>' : ""}</div>`;
    row.addEventListener("click",e=>{ if(e.target.dataset.approve){ openApprovalModal(e.target.dataset.approve); return; } renderDetail(ev.event_id); });
    c.appendChild(row);
  });
}

function renderMetrics(){
  const kpis = {
    total: $("#kpi-total"),
    completed: $("#kpi-completed"),
    human: $("#kpi-human"),
    failed: $("#kpi-failed")
  };
  if (!metrics) {
    // 指标为空时显示 --
    if(kpis.total) kpis.total.textContent = "--";
    if(kpis.completed) kpis.completed.textContent = "--";
    if(kpis.human) kpis.human.textContent = "--";
    if(kpis.failed) kpis.failed.textContent = "--";
    return;
  }
  if(kpis.total) kpis.total.textContent = metrics.total_events ?? "--";
  if(kpis.completed) kpis.completed.textContent = metrics.completed_events ?? "--";
  if(kpis.human) kpis.human.textContent = metrics.human_required_events ?? "--";
  if(kpis.failed) kpis.failed.textContent = metrics.failed_events ?? "--";
}

// ===== 改动点4：修复 renderDetail 降级逻辑 =====
async function renderDetail(id){
  // 保护：先检查元素是否存在
  const curTrace = $("#cur-trace");
  if(curTrace) curTrace.textContent = "加载中…";
  
  let ctx = await jfetch(API+"/events/"+encodeURIComponent(id));
  if(!ctx){
    // 后端可用时，不降级到演示数据，直接报错
    if (backendAvailable) {
      const detailBox = $("#detail");
      if(detailBox) detailBox.innerHTML='<p class="placeholder">加载详情失败，请稍后重试</p>';
      if(curTrace) curTrace.textContent = "--";
      return;
    }
    // 后端完全不可用时，才尝试从演示数据中找
    ctx = window.DEMO_EVENTS.find(x=>x.event_id===id);
    if(!ctx){ 
      const detailBox = $("#detail");
      if(detailBox) detailBox.innerHTML='<p class="placeholder">未找到事件</p>'; 
      if(curTrace) curTrace.textContent = "--";
      return; 
    }
  }
  
  if(curTrace) {
    curTrace.textContent = ctx.trace_id||"--";
    curTrace.title = ctx.trace_id||"--";
  }
  
  const box = $("#detail");
  if(!box) return;
  
  const tl = (ctx.timeline||[]).map(t=>{
    const sc = statusClass(t.status); const dot = dotColor("done");
    return `<div class="item"><div class="dot" style="background:${dot}"></div><div><div class="tl-title">${escapeHtml(t.status)}<span class="tag">${escapeHtml(t.message||"")}</span></div><div class="tl-meta">${escapeHtml(t.at||"")}${t.elapsed_ms!=null? " · "+t.elapsed_ms+"ms":""}</div></div></div>`;
  }).join("");

  const tri = ctx.triage||null;
  const inv = ctx.investigation||null;
  const resp = ctx.response||null;
  const gaps = tri? (tri.evidence_gaps||[]) : (inv? (inv.unresolved_questions||[]) : []);

  box.innerHTML = `
    <h3 style="margin:0 0 6px;">${escapeHtml(ctx.event_id)} · 可审计处理时间线</h3>
    <div class="tl-meta">source=${escapeHtml(ctx.source||"")} · status=<span class="badge ${statusClass(ctx.status)}">${escapeHtml(ctx.status)}</span>${ctx.run_id? " · run_id="+escapeHtml(ctx.run_id):""}</div>

    <div class="sec">① 告警关联（event_summary）</div>
    ${ctx.event_summary? `
      <div class="item"><div class="dot" style="background:#3b82f6"></div><div>
        <div class="tl-title">${escapeHtml(ctx.event_summary.summary||"")}</div>
        <div class="tl-meta">关联前告警 ${ctx.event_summary.alert_count_before} → 关联后事件 ${ctx.event_summary.event_count_after}；依据：${escapeHtml(ctx.event_summary.correlation_reason||"")}</div>
        <div class="tl-meta">实体：${escapeHtml(JSON.stringify(ctx.event_summary.entities||{}))}</div>
      </div></div>`:'<div class="tl-meta">无 event_summary</div>'}

    <div class="sec">② 风险研判（triage）</div>
    ${tri? `<div class="item"><div class="dot" style="background:#22c55e"></div><div>
      <div class="tl-title">verdict=${escapeHtml(tri.verdict)} · risk_score=${tri.risk_score} · priority=${escapeHtml(tri.priority)}<span class="tag">confidence=${tri.confidence}</span></div>
      <div class="tl-meta">${escapeHtml(tri.summary||"")}</div>
      <div class="tl-meta">支持证据：${(() => {
  const evidences = tri.supporting_evidence_refs || [];
  if (evidences.length === 0) return "无";
  const displayCount = 3;
  const visibleEvidences = evidences.slice(0, displayCount).map(function(e) { return "<li>" + escapeHtml(e) + "</li>"; }).join("");
  const hiddenEvidences = evidences.slice(displayCount).map(function(e) { return "<li>" + escapeHtml(e) + "</li>"; }).join("");
  let html = "<ul class=\"evidence-list\">" + visibleEvidences;
  if (hiddenEvidences) {
    html += "<details><summary>展开剩余 " + (evidences.length - displayCount) + " 条证据</summary>" + hiddenEvidences + "</ul></details>";
  } else {
    html += "</ul>";
  }
  return html;
})()}</div>
      <div class="tl-meta">反对证据：${escapeHtml((tri.opposing_evidence_refs||[]).join("；"))||"无"}</div>
    </div></div>`:'<div class="tl-meta">无 triage 结果</div>'}

    ${gaps.length? `<div class="ev-gap"><b>证据缺口 / 未解决问题：</b>${escapeHtml(gaps.join("；"))}</div>`:""}

    <div class="sec">③ 调查证据链（investigation.steps）</div>
    ${(inv&&inv.steps&&inv.steps.length)? inv.steps.map(s=>`
      <div class="item"><div class="dot" style="background:#3b82f6"></div><div>
        <div class="tl-title">步骤${s.step_no}：${escapeHtml(s.goal||"")}</div>
        <div class="tl-meta">${s.tool_request? "tool="+escapeHtml(s.tool_request.tool_name||"")+"，params="+escapeHtml(JSON.stringify(s.tool_request.params||{})) :""}</div>
        <div class="tl-meta">观察：${escapeHtml(s.observation||"")}</div>
      </div></div>`).join("") : '<div class="tl-meta">无调查步骤</div>'}

    <div class="sec">④ 处置记录（response）</div>
    ${resp&&resp.plan? `<div class="item"><div class="dot" style="background:#eab308"></div><div>
      <div class="tl-title">plan：action=${escapeHtml(resp.plan.action)} · target=${escapeHtml(resp.plan.target)} · risk_level=${escapeHtml(resp.plan.risk_level)}</div>
      <div class="tl-meta">reason=${escapeHtml(resp.plan.reason||"")} · approval_required=${resp.plan.approval_required}</div>
    </div></div>`:'<div class="tl-meta">无处置方案</div>'}
    ${resp&&resp.execution? `<div class="item"><div class="dot" style="background:${resp.execution.executed?"#22c55e":"#94a3b8"}"></div><div>
      <div class="tl-title">execution：mode=${escapeHtml(resp.execution.mode)} · platform_status=${escapeHtml(resp.execution.platform_status||"")}</div>
      <div class="tl-meta">executed=${resp.execution.executed}${resp.execution.error? " · error="+escapeHtml(resp.execution.error):""}</div>
    </div></div>`:""}
    ${resp&&resp.verification? `<div class="item"><div class="dot" style="background:${resp.verification.status==="EFFECTIVE"?"#22c55e":"#eab308"}"></div><div>
      <div class="tl-title">verification：status=${escapeHtml(resp.verification.status)} · final_status=${escapeHtml(resp.verification.final_status)}</div>
      <div class="tl-meta">method=${escapeHtml(resp.verification.method||"")}</div>
    </div></div>`:""}

    <div class="sec">⑤ 状态时间线（timeline）</div>
    ${tl || '<div class="tl-meta">无时间线数据</div>'}

    ${ctx.status==="APPROVAL_REQUIRED"? '<div style="margin-top:12px;"><button class="btn btn-danger" id="open-approve">⚠️ 打开审批弹窗</button></div>':""}
  `;
  const ob = $("#open-approve"); if(ob) ob.addEventListener("click",()=>openApprovalModal(ctx.event_id));
}
// ===== 改动点4结束 =====

/* ---------- 审批弹窗 ---------- */
const modal = $("#approval-modal");
function openApprovalModal(id){
  const mEvent = $("#m-event");
  const mApproved = $("#m-approved");
  const mApprover = $("#m-approver");
  const mReason = $("#m-reason");
  const mIdem = $("#m-idem");
  
  if(mEvent) mEvent.value = id;
  if(mApproved) mApproved.value="";
  if(mApprover) mApprover.value="";
  if(mReason) mReason.value="";
  if(mIdem) mIdem.value = uuid();
  
  if(modal) modal.style.display="flex";
}
function closeApprovalModal(){ if(modal) modal.style.display="none"; }
window.openApprovalModal = openApprovalModal; window.closeApprovalModal = closeApprovalModal;

const approvalForm = $("#approval-form");
if(approvalForm) {
  approvalForm.addEventListener("submit",async function(e){
    e.preventDefault();
    const id = $("#m-event")?.value;
    const approved = ($("#m-approved")?.value) === "true";
    const body = { 
      approved, 
      approver:($("#m-approver")?.value||"").trim(), 
      reason:($("#m-reason")?.value||"").trim(), 
      idempotency_key:($("#m-idem")?.value||uuid()) 
    };
    let res = null;
    try{ 
      res = await fetch(API+"/events/"+encodeURIComponent(id)+"/approval",{ 
        method:"POST", 
        headers:{"Content-Type":"application/json"}, 
        body:JSON.stringify(body) 
      }); 
    } catch(err){ res=null; }
    if(res && res.ok){ 
      alert("审批已提交（真实接口）"); 
      closeApprovalModal(); 
      renderDetail(id); 
    } else { 
      alert("后端不可用，已按演示模式记录审批（不会真实生效）\n\n"+JSON.stringify(body,null,2)); 
      closeApprovalModal(); 
    }
  });
}

// 全局错误兜底
window.onerror = function(msg, url, line, col, error) {
  console.error('全局错误:', msg, error);
  const app = $("#app");
  if (app) {
    app.innerHTML = `
      <div class="error-fallback">
        <h2>系统繁忙，请稍后重试</h2>
        <p>${escapeHtml(msg)}</p>
        <button onclick="location.reload()">重新加载</button>
      </div>
    `;
  }
};

loadAll();