// demo-data.js
// 内嵌演示数据（字段命名严格对齐 sec_agent/domain/models.py）
// EventListItem: event_id/run_id/trace_id/status/source/summary
// EventContext: trace_id/run_id/event_id/status/source/alert_refs/event_summary/triage/investigation/response/timeline/errors
// TimelineEntry: at/status/message/elapsed_ms
window.DEMO_EVENTS = [
  {
    event_id:"EVT-001", run_id:"run-001", trace_id:"trace-demo-001", status:"COMPLETED",
    source:"fixed_sample", summary:"5 条 WebShell 告警关联为 1 个事件，涉及资产 web-server-01，已处置闭环。",
    alert_refs:["alert-001","alert-002","alert-003","alert-004","alert-005"],
    event_summary:{ event_id:"EVT-001", alert_refs:["alert-001","alert-002","alert-003","alert-004","alert-005"],
      first_seen_at:"2026-08-21T09:00:00Z", last_seen_at:"2026-08-21T09:04:00Z",
      entities:{ src_ips:["10.0.0.5"], dst_ips:["192.168.1.100"], assets:["web-server-01"] },
      correlation_reason:"按相同攻击类型(WebShell)、时间窗口(5分钟)与关键实体(源IP/资产)关联",
      alert_count_before:5, event_count_after:1, summary:"5 条 WebShell 告警关联为 1 个事件" },
    triage:{ verdict:"malicious", confidence:0.86, risk_score:78, priority:"high",
      supporting_evidence_refs:["告警类型为 WebShell","目标资产为核心服务器","存在 C2 外联"],
      opposing_evidence_refs:[], evidence_gaps:["未知攻击者初始入侵途径"],
      should_investigate:true, summary:"高风险 WebShell 攻击，建议进入深度调查并处置" },
    investigation:{ steps:[
      { step_no:1, goal:"确认源 IP 历史行为", tool_request:{ tool_name:"XDR_Log_Query", params:{ query:"src_ip=10.0.0.5" } }, observation:"发现 3 条登录失败记录，存在暴力破解迹象" },
      { step_no:2, goal:"确认 WebShell 落地文件", tool_request:{ tool_name:"EDR_File_Query", params:{ asset:"web-server-01" } }, observation:"在 /var/www/html/ 发现可疑 .php 文件" },
      { step_no:3, goal:"还原攻击过程", observation:"确认攻击链：暴力破解 → 上传 WebShell → C2 通信" }
    ], conclusion:"malicious", final_confidence:0.89, key_evidence_refs:["webshell 上传日志","C2 通信流量"],
      unresolved_questions:["攻击者如何获得初始访问权限"], recommended_actions:["封禁源 IP 10.0.0.5","隔离受影响主机 web-server-01"],
      needs_human:false, summary:"确认为 WebShell 攻击，已还原攻击过程" },
    response:{ plan:{ action:"stateful_mock_containment", target:"10.0.0.5", reason:"外部攻击源，存在 C2 通信", risk_level:"HIGH", approval_required:false, rollback_available:true },
      execution:{ executed:true, mode:"mock", platform_status:"success", error:null, retry_count:0, idempotency_key:"uuid-demo-001" },
      verification:{ status:"EFFECTIVE", method:"查询有状态 Mock 处置记录", evidence_refs:[], adjustment_suggestion:null, final_status:"COMPLETED" } },
    timeline:[
      { at:"2026-08-21T09:00:00Z", status:"RECEIVED", message:"事件已接收" },
      { at:"2026-08-21T09:00:30Z", status:"CORRELATING", message:"正在关联 5 条告警" },
      { at:"2026-08-21T09:01:00Z", status:"TRIAGED", message:"风险研判完成，risk_score=78" },
      { at:"2026-08-21T09:01:30Z", status:"INVESTIGATING", message:"深度调查 Agent 启动" },
      { at:"2026-08-21T09:04:00Z", status:"DECISION_READY", message:"处置方案就绪" },
      { at:"2026-08-21T09:05:00Z", status:"EXECUTING", message:"执行 Mock 处置" },
      { at:"2026-08-21T09:05:30Z", status:"VERIFYING", message:"验证处置效果" },
      { at:"2026-08-21T09:06:00Z", status:"COMPLETED", message:"处置闭环完成" }
    ], errors:[]
  },
  {
    event_id:"EVT-002", run_id:"run-002", trace_id:"trace-demo-002", status:"INVESTIGATING",
    source:"xdr", summary:"异常外联告警，证据不足，深度调查 Agent 正在补充证据。",
    alert_refs:["alert-010"],
    event_summary:{ event_id:"EVT-002", alert_refs:["alert-010"], first_seen_at:"2026-08-21T10:20:00Z", last_seen_at:"2026-08-21T10:20:00Z",
      entities:{ src_ips:["172.16.0.8"], dst_ips:["203.0.113.5"] }, correlation_reason:"单条异常外联告警，进入调查补充证据", alert_count_before:1, event_count_after:1, summary:"单条异常外联告警" },
    triage:{ verdict:"uncertain", confidence:0.55, risk_score:48, priority:"medium",
      supporting_evidence_refs:[], opposing_evidence_refs:[], evidence_gaps:["外联目标 203.0.113.5 意图不明","缺少主机侧进程证据"],
      should_investigate:true, summary:"证据不足，进入深度调查" },
    investigation:{ steps:[
      { step_no:1, goal:"查询目标 IP 威胁情报", tool_request:{ tool_name:"TI_Query", params:{ ip:"203.0.113.5" } }, observation:"目标 IP 暂无明确恶意标记" },
      { step_no:2, goal:"查询主机进程与网络连接", tool_request:{ tool_name:"EDR_Process_Query", params:{ asset:"host-172-16-0-8" } }, observation:"调查中…" }
    ], conclusion:"uncertain", final_confidence:0.6, key_evidence_refs:[], unresolved_questions:["外联是否为合法业务回调"], recommended_actions:[], needs_human:false, summary:"调查中，证据尚不充分" },
    response:null,
    timeline:[
      { at:"2026-08-21T10:20:00Z", status:"RECEIVED", message:"事件已接收" },
      { at:"2026-08-21T10:20:30Z", status:"CORRELATING", message:"关联完成（单条）" },
      { at:"2026-08-21T10:21:00Z", status:"TRIAGED", message:"研判为 uncertain" },
      { at:"2026-08-21T10:21:30Z", status:"INVESTIGATING", message:"深度调查 Agent 补充证据中" }
    ], errors:[]
  },
  {
    event_id:"EVT-003", run_id:"run-003", trace_id:"trace-demo-003", status:"APPROVAL_REQUIRED",
    source:"fixed_sample", summary:"内存马注入行为，Agent 建议隔离受感染主机，等待人工审批。",
    alert_refs:["alert-021"],
    event_summary:{ event_id:"EVT-003", alert_refs:["alert-021"], first_seen_at:"2026-08-21T11:15:00Z", last_seen_at:"2026-08-21T11:15:00Z",
      entities:{ assets:["app-server-02"] }, correlation_reason:"单条内存马注入告警，判定为 P0 高危", alert_count_before:1, event_count_after:1, summary:"内存马注入告警" },
    triage:{ verdict:"malicious", confidence:0.91, risk_score:88, priority:"high",
      supporting_evidence_refs:["检测到内存马注入行为","影响生产环境 app-server-02"], opposing_evidence_refs:[], evidence_gaps:[],
      should_investigate:true, summary:"P0 高危，建议立即隔离" },
    investigation:{ steps:[
      { step_no:1, goal:"确认注入行为与影响范围", tool_request:{ tool_name:"EDR_Memory_Scan", params:{ asset:"app-server-02" } }, observation:"确认内存马存在，影响生产环境" }
    ], conclusion:"malicious", final_confidence:0.91, key_evidence_refs:["内存马检测日志"], unresolved_questions:[], recommended_actions:["隔离主机 app-server-02"], needs_human:true, summary:"建议隔离受感染主机，需人工审批" },
    response:{ plan:{ action:"isolate_host", target:"app-server-02", reason:"P0 级内存马注入，影响生产环境", risk_level:"HIGH", approval_required:true, rollback_available:true }, execution:null, verification:null },
    timeline:[
      { at:"2026-08-21T11:15:00Z", status:"RECEIVED", message:"事件已接收" },
      { at:"2026-08-21T11:15:30Z", status:"CORRELATING", message:"关联完成" },
      { at:"2026-08-21T11:16:00Z", status:"TRIAGED", message:"研判为 malicious，risk_score=88" },
      { at:"2026-08-21T11:16:30Z", status:"INVESTIGATING", message:"深度调查完成" },
      { at:"2026-08-21T11:17:00Z", status:"DECISION_READY", message:"处置方案就绪（隔离主机）" },
      { at:"2026-08-21T11:17:30Z", status:"APPROVAL_REQUIRED", message:"等待人工审批" }
    ], errors:[]
  },
  {
    event_id:"EVT-004", run_id:"run-004", trace_id:"trace-demo-004", status:"FAILED",
    source:"fixed_sample", summary:"上游日志源断开，数据质量不足，无法完成研判。",
    alert_refs:["alert-030"],
    event_summary:null,
    triage:null, investigation:null, response:null,
    timeline:[
      { at:"2026-08-21T08:00:00Z", status:"RECEIVED", message:"事件已接收" },
      { at:"2026-08-21T08:00:05Z", status:"FAILED", message:"上游日志源断开，数据校验失败" }
    ],
    errors:[{ at:"2026-08-21T08:00:05Z", stage:"correlate", message:"上游日志源断开连接", recoverable:true }]
  }
];

window.DEMO_METRICS = {
  total_events:42, completed_events:38, human_required_events:3, failed_events:1,
  note:"演示数据：真实数据就绪后由 GET /metrics 返回；无可靠标签时不统计准确率/召回率等指标"
};
