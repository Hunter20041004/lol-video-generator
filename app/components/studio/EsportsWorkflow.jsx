"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseDateRange } from "@/utils/esports/dateRange";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PreviewPanel } from "./PreviewPanel";
import { WorkflowStatus } from "./WorkflowStatus";
import { humanizeWorkflowError, normalizeEsportsPreview } from "./studioModel";

function localDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("sv-SE");
}

function candidateLabel(candidate) {
  const teamA = candidate.teamA || candidate.teams?.[0] || "隊伍 A";
  const teamB = candidate.teamB || candidate.teams?.[1] || "隊伍 B";
  const score = candidate.seriesScore || candidate.score;
  const status = candidate.status === "scheduled" ? "未開打" : candidate.status === "awaiting_result" ? "待結果" : candidate.canPreview === false ? "數據未齊" : candidate.status === "completed" ? "已完成" : "";
  return `${candidate.date ? `${candidate.date} · ` : ""}${candidate.league || "賽事"} · ${teamA} vs ${teamB}${score ? ` · ${score}` : ""}${status ? ` · ${status}` : ""}`;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({ error: "伺服器回應格式錯誤。" }));
  if (!response.ok || payload.success === false) throw Object.assign(new Error(payload.error), { payload });
  return payload;
}

export function EsportsWorkflow({ portfolioReadOnly = false, hidden = false }) {
  const [date, setDate] = useState(() => localDateOffset(-1));
  const [endDate, setEndDate] = useState(() => localDateOffset(-1));
  const [scan, setScan] = useState(null);
  const [seriesId, setSeriesId] = useState("");
  const [preview, setPreview] = useState(null);
  const [publishResult, setPublishResult] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const rangeError = useMemo(() => {
    try { parseDateRange(date, endDate); return ""; } catch (caught) { return caught.message; }
  }, [date, endDate]);
  const entries = scan?.entries || scan?.candidates || [];
  const selected = useMemo(
    () => scan?.candidates?.find((candidate) => candidate.seriesId === seriesId) || null,
    [scan, seriesId]
  );

  function changeDate(event, end = false) {
    if (end) setEndDate(event.target.value);
    else setDate(event.target.value);
    setScan(null);
    setSeriesId("");
    setPreview(null);
    setPublishResult(null);
    setError("");
  }

  function changeSeries(nextSeriesId) {
    setSeriesId(nextSeriesId);
    setPreview(null);
    setPublishResult(null);
    setError("");
  }

  async function scanCandidates() {
    if (rangeError) return;
    setBusyAction("scan");
    setError("");
    setPreview(null);
    setPublishResult(null);
    setScan(null);
    setSeriesId("");
    try {
      const payload = await requestJson("/api/esports/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: date, endDate, activeMode: "auto", tournamentScope: "configured", languages: ["zh"] }),
      });
      setScan(payload);
      setSeriesId(payload.candidates?.[0]?.seriesId || "");
    } catch (caught) {
      setError(humanizeWorkflowError(caught.payload || { error: caught.message }));
    } finally {
      setBusyAction("");
    }
  }

  async function createPreview() {
    if (!scan?.scanId || !selected || selected.canPreview === false) return;
    setBusyAction("preview");
    setError("");
    setPreview(null);
    setPublishResult(null);
    try {
      const payload = await requestJson("/api/esports/player-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: scan.scanId, seriesId, mode: "preview", languages: ["zh"] }),
      });
      setPreview(normalizeEsportsPreview(payload));
    } catch (caught) {
      setError(humanizeWorkflowError(caught.payload || { error: caught.message }));
    } finally {
      setBusyAction("");
    }
  }

  function publishPayload(platforms) {
    const primary = preview?.payloads?.[0] || { dataType: "PLAYER_RADAR" };
    return {
      action: "publish",
      platforms,
      videos: preview.videos,
      analysis: {
        ...primary,
        dataType: "PLAYER_RADAR",
        localizedPayloads: Object.fromEntries(preview.payloads.map((payload) => [payload.locale, payload])),
      },
    };
  }

  async function publishPreview(platforms = ["instagram", "threads"]) {
    if (!preview) return;
    setBusyAction("publish");
    setError("");
    try {
      const payload = await requestJson("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publishPayload(platforms)),
      });
      setPublishResult(payload);
    } catch (caught) {
      setError(humanizeWorkflowError(caught.payload || { error: caught.message }));
    } finally {
      setBusyAction("");
    }
  }

  return (
    <section data-testid="esports-workflow" hidden={hidden} aria-hidden={hidden} className="studio-workflow">
      <div className="studio-control-panel">
        <div className="studio-section-heading">
          <span>ESPORTS VIDEO</span>
          <h1>賽事影片</h1>
          <p>查詢一級賽事與賽程，選一場完整賽事製作 40 秒解析，再決定是否發布。</p>
        </div>

        <div className="studio-date-range mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="studio-field">
          <label htmlFor="esports-date"><CalendarDays aria-hidden="true" />開始日期</label>
          <Input
            id="esports-date"
            type="date"
            value={date}
            onChange={changeDate}
            aria-describedby="esports-range-hint"
            aria-invalid={!!rangeError}
            disabled={busyAction !== "" || portfolioReadOnly}
          />
        </div>
        <div className="studio-field">
          <label htmlFor="esports-end-date">結束日期</label>
          <Input id="esports-end-date" type="date" value={endDate} onChange={(event) => changeDate(event, true)}
            aria-describedby="esports-range-hint" aria-invalid={!!rangeError} disabled={busyAction !== "" || portfolioReadOnly} />
        </div>
        </div>
        <p id="esports-range-hint" className="mt-3 text-sm text-muted-foreground">首尾日都包含 · 最多 31 天 · 日期依 UTC（台灣早上 8 點換日）</p>
        {rangeError && <WorkflowStatus tone="error">{rangeError}</WorkflowStatus>}
        <Button className="studio-primary-action" onClick={scanCandidates} disabled={!!rangeError || busyAction !== "" || portfolioReadOnly}>
          <Search aria-hidden="true" />
          {busyAction === "scan" ? "正在查詢區間…" : "尋找區間賽事"}
        </Button>

        {scan && (
          <div className="studio-step-block">
            <p className="text-sm text-muted-foreground">來源已登錄 {entries.length} 場 · {scan.candidates?.length || 0} 場數據完整可預覽</p>
            {scan.sourceStatus?.status === "cached" && (
              <WorkflowStatus>
                <strong className="block">使用已保存的賽事資料</strong>
                {scan.sourceStatus.cacheReason === "rate_limit" && (
                  <span className="block">Leaguepedia 暫時限制請求；這份資料仍可產生預覽。</span>
                )}
                {Number.isFinite(Date.parse(scan.sourceStatus.cachedAt)) && (
                  <span className="block">資料取得時間：<time dateTime={scan.sourceStatus.cachedAt}>
                    {new Date(scan.sourceStatus.cachedAt).toLocaleString("zh-TW", {
                      year: "numeric", month: "numeric", day: "numeric",
                      hour: "2-digit", minute: "2-digit", timeZoneName: "short",
                    })}
                  </time></span>
                )}
              </WorkflowStatus>
            )}
            <div className="studio-field">
              <label htmlFor="esports-series"><span>02</span>選擇系列賽</label>
              {entries.length ? (
                <Select value={seriesId} onValueChange={changeSeries} disabled={busyAction !== "" || portfolioReadOnly}>
                  <SelectTrigger id="esports-series" className="studio-select"><SelectValue placeholder="查看賽程，選一場完整系列賽" /></SelectTrigger>
                  <SelectContent>
                    {entries.map((candidate) => (
                      <SelectItem key={candidate.seriesId} value={candidate.seriesId} disabled={candidate.canPreview === false}>{candidateLabel(candidate)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <WorkflowStatus>這個區間的資料來源尚未登錄一級賽事。未公布的賽程不會出現在結果中。</WorkflowStatus>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">未開打、待結果或數據未齊的場次僅供查看；未公布的賽程不在清單中。</p>
            {selected && (
              <div className="studio-selection-summary">
                <strong>{candidateLabel(selected)}</strong>
                <span>建議主角：{selected.recommendedMvp?.name || "系統將依比賽數據判定"}</span>
              </div>
            )}
            <Button variant="outline" className="studio-primary-action" onClick={createPreview} disabled={!selected || selected.canPreview === false || busyAction !== "" || portfolioReadOnly}>
              <Sparkles aria-hidden="true" />
              {busyAction === "preview" ? "正在渲染 40 秒影片…" : "產生影片預覽"}
            </Button>
          </div>
        )}

        {portfolioReadOnly && <WorkflowStatus>目前是作品集唯讀模式，掃描、渲染與發布已停用。</WorkflowStatus>}
        {busyAction && <WorkflowStatus busy>正在處理，請保留這個頁面。</WorkflowStatus>}
        {error && <WorkflowStatus tone="error">{error}</WorkflowStatus>}
      </div>

      <PreviewPanel
        preview={preview}
        publishResult={publishResult}
        publishing={busyAction === "publish"}
        onPublish={() => publishPreview()}
        onRetry={(jobs) => publishPreview([...new Set(jobs.map((job) => job.platform))])}
        disabled={portfolioReadOnly}
      />
    </section>
  );
}
