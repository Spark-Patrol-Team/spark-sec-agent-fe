// app.js
// 严格对照李雨妍仓库接口基线：
// POST /runs (source, sample_id) -> 启动
// GET  /events -> list[EventListItem]
// GET  /events/{event_id} -> EventContext
// GET  /events/{event_id}/timeline -> list[TimelineEntry]
// POST /events/{event_id}/approval -> ApprovalDecision {approved,approver,reason,idempotency_key}
// GET  /metrics -> {total_events,completed_events,human_required_events,failed_events,note}
const API = "http://localhost:8000";
const $ = (s)=>document.querySelector(s);
const escapeHtml = (s)=> String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const statusClass = (st)=>({COMPLETED:"b-completed",INVESTIGATING:"b-investigating",APPROVAL_REQUIRED:"b-approval",FAILED:"b-failed",HUMAN_REQUIRED:"b-human"}[st]||"");
const dotColor = (st)=>({done:"#22c55e",doing:"#eab308",failed:"#ef4444",pending:"#94a3b8"}[st]||"#94a3b8");

let events = []; let metrics = null; let usingDemo = false;

async function jfetch(url){
  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error(r.status);
    return await r.json();
  }catch(e){ return null; }
}

function uuid(){ return crypto.randomUUID? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==="x"?r:(r&0x3|0x8)).toString(16);}); }

async function loadAll(){
  // 列表
  let list = await jfetch(API+"/events");
  if(!list || !Array.isArray(list)){ list = window.DEMO_EVENTS.map(e=>({event_id:e.event_id,run_id:e.run_id,trace_id:e.trace_id,status:e.status,source:e.source,summary:e.summary})); usingDemo=true; }
  events = list;
  renderList();
  // 指标
  let m = await jfetch(API+"/metrics");
  if(!m){ m = window.DEMO_METRICS; usingDemo=true; }
  metrics = m; renderMetrics();
  $("#source-tag").textContent = usingDemo? "数据来源：演示数据（后端未启动，已自动降级）" : "数据来源：李雨妍后端接口（真实数据）";
}

function renderList(){
  const c = $("#event-list"); c.innerHTML="";
  events.forEach(ev=>{
    const row = document.createElement("div"); row.className="event-row";
    row.innerHTML = `
      <div>${escapeHtml(ev.event_id)}</div>
      <div style="font-size:10px;color:#94a3b8;">${escapeHtml((ev.trace_id||"").slice(0,10))}…</div>
      <div><span class="badge ${statusClass(ev.status)}">${escapeHtml(ev.status)}</span></div>
      <div>${escapeHtml(ev.source||"")}</div>
      <div style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(ev.summary||"")}">${escapeHtml(ev.summary||"")}</div>
      <div>${ev.status==="APPROVAL_REQUIRED"? '<button class="btn btn-danger" data-approve="'+escapeHtml(ev.event_id)+'">审批</button>' : ""}</div>`;
    row.addEventListener("click",e=>{ if(e.target.dataset.approve){ openApprovalModal(e.target.dataset.approve); return; } renderDetail(ev.event_id); });
    c.appendChild(row);
  });
}

function renderMetrics(){
  $("#kpi-total").textContent = metrics.total_events?? "--";
  $("#kpi-completed").textContent = metrics.completed_events?? "--";
  $("#kpi-human").textContent = metrics.human_required_events?? "--";
  $("#kpi-failed").textContent = metrics.failed_events?? "--";
  $("#metrics-note").textContent = metrics.note? "注："+metrics.note : "";
}

async function renderDetail(id){
  $("#cur-trace").textContent="加载中…";
  let ctx = await jfetch(API+"/events/"+encodeURIComponent(id));
  if(!ctx){
    ctx = window.DEMO_EVENTS.find(x=>x.event_id===id);
    if(!ctx){ $("#detail").innerHTML='<p class="placeholder">未找到事件</p>'; return; }
  }
  $("#cur-trace").textContent = ctx.trace_id||"--";
  const box = $("#detail");
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
      <div class="tl-meta">支持证据：${escapeHtml((tri.supporting_evidence_refs||[]).join("；"))||"无"}</div>
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

/* ---------- 审批弹窗 ---------- */
const modal = $("#approval-modal");
function openApprovalModal(id){
  $("#m-event").value = id; $("#m-approved").value=""; $("#m-approver").value=""; $("#m-reason").value="";
  $("#m-idem").value = uuid(); modal.style.display="flex";
}
function closeApprovalModal(){ modal.style.display="none"; }
window.openApprovalModal = openApprovalModal; window.closeApprovalModal = closeApprovalModal;

$("#approval-form").addEventListener("submit",async function(e){
  e.preventDefault();
  const id = $("#m-event").value;
  const approved = $("#m-approved").value === "true";
  const body = { approved, approver:$("#m-approver").value.trim(), reason:$("#m-reason").value.trim(), idempotency_key:$("#m-idem").value };
  let res = null;
  try{ res = await fetch(API+"/events/"+encodeURIComponent(id)+"/approval",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }); }
  catch(err){ res=null; }
  if(res && res.ok){ alert("审批已提交（真实接口）"); closeApprovalModal(); renderDetail(id); }
  else { alert("后端不可用，已按演示模式记录审批（不会真实生效）\n\n"+JSON.stringify(body,null,2)); closeApprovalModal(); }
});

loadAll();
