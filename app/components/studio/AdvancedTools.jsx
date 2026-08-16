"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Database, RefreshCw, ScanSearch, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkflowStatus } from "./WorkflowStatus";

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({ error: "伺服器回應格式錯誤。" }));
  if (!response.ok || payload.success === false) throw new Error(payload.error || "操作失敗。");
  return payload;
}

function compactNumber(value) {
  return new Intl.NumberFormat("zh-TW", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function candidateId(candidate = {}) {
  return candidate.candidateId || candidate.role || "";
}

function candidateTitle(candidate = {}) {
  if (candidate.kind === "META_TIER_RANKING") return `${candidate.role || "全位置"} 梯度榜`;
  return [candidate.champion, candidate.role].filter(Boolean).join(" · ") || "未命名題材";
}

function MetaTool({ portfolioReadOnly, portfolioDemoState }) {
  const portfolioCandidate = portfolioDemoState?.candidates?.[0];
  const [mode, setMode] = useState("tier");
  const [position, setPosition] = useState("Mid");
  const [patch, setPatch] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [candidates, setCandidates] = useState(() => portfolioDemoState?.candidates || []);
  const [selectedId, setSelectedId] = useState(() => candidateId(portfolioCandidate));
  const [result, setResult] = useState(() => portfolioDemoState?.renderResult || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function scan() {
    setBusy(true); setError(""); setResult(null);
    try {
      const payload = await requestJson("/api/meta-factory/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch, region: "global", queue: "ranked_solo_duo", rankPreset: "emerald_plus", position, mode }),
      });
      const pool = mode === "tier" ? payload.candidates?.tierRankings || [] : payload.candidates?.offmeta || [];
      setSnapshotId(payload.snapshotId || "");
      setCandidates(pool);
      setSelectedId(candidateId(pool[0]));
      setResult(payload);
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  async function render() {
    if (!snapshotId || !selectedId) return;
    setBusy(true); setError("");
    try {
      setResult(await requestJson("/api/meta-factory/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId, mode, candidateId: selectedId }),
      }));
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  const video = result?.videos?.[0] || result?.render?.videos?.[0];
  return (
    <div className="studio-tool-pane">
      {portfolioDemoState && <WorkflowStatus tone="success">Synthetic portfolio fixture · 不會連接正式資料或發布。</WorkflowStatus>}
      <p>需要額外題材時，才從版本數據找梯度榜或非主流玩法。</p>
      <div className="studio-tool-grid">
        <label>題材<Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tier">梯度榜</SelectItem><SelectItem value="offmeta">非主流玩法</SelectItem></SelectContent></Select></label>
        <label>位置<Select value={position} onValueChange={setPosition}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Top", "Jungle", "Mid", "ADC", "Support"].map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent></Select></label>
        <label>版本（可留空）<input value={patch} onChange={(event) => setPatch(event.target.value)} placeholder="例如 26.16" /></label>
      </div>
      <Button onClick={scan} disabled={busy || portfolioReadOnly}><ScanSearch aria-hidden="true" />{busy ? "處理中…" : "掃描 Meta 題材"}</Button>
      {candidates.length > 0 && <>
        <Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger className="studio-tool-select"><SelectValue placeholder="選擇題材" /></SelectTrigger><SelectContent>{candidates.map((candidate) => <SelectItem key={candidateId(candidate)} value={candidateId(candidate)}>{candidateTitle(candidate)}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={render} disabled={!selectedId || busy || portfolioReadOnly}><Sparkles aria-hidden="true" />產生 Meta 預覽</Button>
      </>}
      {video?.videoUrl && <video className="studio-tool-video" src={video.videoUrl} controls playsInline />}
      {error && <WorkflowStatus tone="error">{error}</WorkflowStatus>}
    </div>
  );
}

function InsightsTool({ portfolioReadOnly }) {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(sync = false) {
    setBusy(true); setError("");
    try {
      if (sync) await requestJson("/api/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) });
      const payload = await requestJson("/api/insights", { cache: "no-store" });
      setReport(payload.report);
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(false); }, []);
  const totals = report?.totals || {};
  return (
    <div className="studio-tool-pane">
      <div className="studio-tool-heading"><div><h3>內容成效</h3><p>快速確認觀看與互動趨勢。</p></div><Button variant="outline" onClick={() => load(true)} disabled={busy || portfolioReadOnly}><RefreshCw aria-hidden="true" />同步</Button></div>
      <div className="studio-tool-metrics">
        <div><span>總觀看</span><strong>{compactNumber(totals.views)}</strong></div>
        <div><span>總互動</span><strong>{compactNumber(totals.engagements)}</strong></div>
        <div><span>追蹤貼文</span><strong>{compactNumber(totals.posts)}</strong></div>
      </div>
      <div className="studio-tool-posts">{(report?.posts || []).slice(0, 6).map((post) => <div key={post.id || post.taskId}><span>{post.title || "未命名貼文"}</span><strong>{compactNumber(post.latest?.views)} views</strong></div>)}</div>
      {busy && <WorkflowStatus busy>正在同步成效。</WorkflowStatus>}
      {error && <WorkflowStatus tone="error">{error}</WorkflowStatus>}
    </div>
  );
}

function QueueTool() {
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const summary = useMemo(() => jobs.reduce((result, job) => ({ ...result, [job.status]: (result[job.status] || 0) + 1 }), {}), [jobs]);

  async function load() {
    setBusy(true); setError("");
    try { setJobs((await requestJson("/api/publish", { cache: "no-store" })).jobs || []); }
    catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);
  return (
    <div className="studio-tool-pane">
      <div className="studio-tool-heading"><div><h3>發布佇列</h3><p>只查看目前工作，不在這裡建立批次發布。</p></div><Button variant="outline" onClick={load} disabled={busy}><RefreshCw aria-hidden="true" />重新整理</Button></div>
      <div className="studio-queue-summary">{Object.entries(summary).map(([status, count]) => <span key={status}>{status} <strong>{count}</strong></span>)}</div>
      <div className="studio-tool-posts">{jobs.slice(0, 12).map((job) => <div key={job.id}><span>{job.platform} · {job.locale || "zh"}</span><strong>{job.status}</strong></div>)}</div>
      {!busy && jobs.length === 0 && <div className="studio-list-empty">目前沒有發布工作。</div>}
      {error && <WorkflowStatus tone="error">{error}</WorkflowStatus>}
    </div>
  );
}

export function AdvancedTools({ portfolioReadOnly = false, portfolioDemoState = null }) {
  return (
    <Tabs defaultValue="meta" className="studio-tools-tabs">
      <TabsList aria-label="進階工具分類">
        <TabsTrigger value="meta"><Database aria-hidden="true" />Meta</TabsTrigger>
        <TabsTrigger value="insights"><BarChart3 aria-hidden="true" />成效</TabsTrigger>
        <TabsTrigger value="queue"><RefreshCw aria-hidden="true" />佇列</TabsTrigger>
      </TabsList>
      <TabsContent value="meta"><MetaTool portfolioReadOnly={portfolioReadOnly} portfolioDemoState={portfolioDemoState} /></TabsContent>
      <TabsContent value="insights"><InsightsTool portfolioReadOnly={portfolioReadOnly} /></TabsContent>
      <TabsContent value="queue"><QueueTool /></TabsContent>
    </Tabs>
  );
}
