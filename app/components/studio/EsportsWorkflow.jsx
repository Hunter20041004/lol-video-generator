"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  return `${candidate.league || "賽事"} · ${teamA} vs ${teamB}${score ? ` · ${score}` : ""}`;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({ error: "伺服器回應格式錯誤。" }));
  if (!response.ok || payload.success === false) throw Object.assign(new Error(payload.error), { payload });
  return payload;
}

export function EsportsWorkflow({ portfolioReadOnly = false, hidden = false }) {
  const [date, setDate] = useState(() => localDateOffset(-1));
  const [scan, setScan] = useState(null);
  const [seriesId, setSeriesId] = useState("");
  const [preview, setPreview] = useState(null);
  const [publishResult, setPublishResult] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const selected = useMemo(
    () => scan?.candidates?.find((candidate) => candidate.seriesId === seriesId) || null,
    [scan, seriesId]
  );

  function changeDate(event) {
    setDate(event.target.value);
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
    setBusyAction("scan");
    setError("");
    setPreview(null);
    setPublishResult(null);
    try {
      const payload = await requestJson("/api/esports/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, activeMode: "auto", tournamentScope: "configured", languages: ["zh"] }),
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
    if (!scan?.scanId || !seriesId) return;
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
          <p>從已完成的賽事中選一場，產生 25 秒賽後解析，再決定是否發布。</p>
        </div>

        <div className="studio-field">
          <label htmlFor="esports-date"><CalendarDays aria-hidden="true" />比賽日期</label>
          <input
            id="esports-date"
            type="date"
            value={date}
            onChange={changeDate}
            disabled={busyAction !== "" || portfolioReadOnly}
          />
        </div>
        <Button className="studio-primary-action" onClick={scanCandidates} disabled={!date || busyAction !== "" || portfolioReadOnly}>
          <Search aria-hidden="true" />
          {busyAction === "scan" ? "掃描中…" : "尋找已完成賽事"}
        </Button>

        {scan && (
          <div className="studio-step-block">
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
              <label><span>02</span>選擇系列賽</label>
              {scan.candidates?.length ? (
                <Select value={seriesId} onValueChange={changeSeries} disabled={busyAction !== "" || portfolioReadOnly}>
                  <SelectTrigger className="studio-select"><SelectValue placeholder="選一場系列賽" /></SelectTrigger>
                  <SelectContent>
                    {scan.candidates.map((candidate) => (
                      <SelectItem key={candidate.seriesId} value={candidate.seriesId}>{candidateLabel(candidate)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <WorkflowStatus>這一天在全球一級賽事中沒有找到已完成且資料完整的賽事。</WorkflowStatus>
              )}
            </div>
            {selected && (
              <div className="studio-selection-summary">
                <strong>{candidateLabel(selected)}</strong>
                <span>建議主角：{selected.recommendedMvp?.name || "系統將依比賽數據判定"}</span>
              </div>
            )}
            <Button variant="outline" className="studio-primary-action" onClick={createPreview} disabled={!seriesId || busyAction !== "" || portfolioReadOnly}>
              <Sparkles aria-hidden="true" />
              {busyAction === "preview" ? "正在渲染 25 秒影片…" : "產生影片預覽"}
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
