"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Library, RefreshCw, ScanSearch, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreviewPanel } from "./PreviewPanel";
import { WorkflowStatus } from "./WorkflowStatus";
import { humanizeWorkflowError, normalizeVersionPreview } from "./studioModel";

const MODES = [
  { id: "champion", label: "英雄", dataTypes: ["PATCH"] },
  { id: "system", label: "系統", dataTypes: ["SYSTEM_UPDATE"] },
  { id: "item-rune", label: "裝備／符文", dataTypes: ["ITEM_UPDATE", "RUNE_UPDATE"] },
];

const PUBLISHABLE = new Set(["READY", "FAILED"]);

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({ error: "伺服器回應格式錯誤。" }));
  if (!response.ok || payload.success === false) throw Object.assign(new Error(payload.error), { payload });
  return payload;
}

function itemTitle(item) {
  return item.localizedName || item.targetName || item.payload?.championName || item.payload?.targetName || "未命名內容";
}

function itemDataType(item) {
  return item.payload?.dataType || item.dataType || "";
}

export function VersionWorkflow({ portfolioReadOnly = false, hidden = false }) {
  const [mode, setMode] = useState("champion");
  const [library, setLibrary] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [preview, setPreview] = useState(null);
  const [publishResult, setPublishResult] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const activeMode = MODES.find((entry) => entry.id === mode) || MODES[0];
  const visibleItems = useMemo(() => (
    (library?.items || []).filter((item) => (
      activeMode.dataTypes.includes(itemDataType(item))
      && (PUBLISHABLE.has(item.status || "READY") || item.id === selectedItemId)
    ))
  ), [activeMode, library, selectedItemId]);
  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.id === selectedItemId) || null,
    [selectedItemId, visibleItems]
  );

  const loadLibrary = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setBusyAction("library");
    setError("");
    try {
      const payload = await requestJson("/api/content-factory/library?projectId=lol");
      setLibrary(payload);
    } catch (caught) {
      setError(humanizeWorkflowError(caught.payload || { error: caught.message }));
    } finally {
      if (!quiet) setBusyAction("");
    }
  }, []);

  useEffect(() => {
    if (!hidden && !library) loadLibrary({ quiet: true });
  }, [hidden, library, loadLibrary]);

  useEffect(() => {
    if (!visibleItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(visibleItems[0]?.id || "");
      setPreview(null);
      setPublishResult(null);
    }
  }, [selectedItemId, visibleItems]);

  async function scanVersion() {
    setBusyAction("scan");
    setError("");
    setPreview(null);
    setPublishResult(null);
    try {
      await requestJson("/api/content-factory/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "lol" }),
      });
      await loadLibrary({ quiet: true });
    } catch (caught) {
      setError(humanizeWorkflowError(caught.payload || { error: caught.message }));
    } finally {
      setBusyAction("");
    }
  }

  async function createPreview() {
    if (!selectedItem) return;
    setBusyAction("preview");
    setError("");
    setPreview(null);
    setPublishResult(null);
    try {
      const payload = await requestJson("/api/content-factory/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem.id, render: true }),
      });
      setPreview(normalizeVersionPreview(payload));
      setLibrary((current) => ({
        ...(current || {}),
        items: (current?.items || []).map((item) => item.id === payload.item?.id ? { ...item, ...payload.item } : item),
      }));
    } catch (caught) {
      setError(humanizeWorkflowError(caught.payload || { error: caught.message }));
    } finally {
      setBusyAction("");
    }
  }

  async function publishPreview() {
    if (!selectedItem || !preview) return;
    setBusyAction("publish");
    setError("");
    try {
      const payload = await requestJson("/api/content-factory/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "lol", itemIds: [selectedItem.id], action: "publish" }),
      });
      const result = payload.results?.[0];
      setPublishResult(result?.publish || { jobs: [] });
      if (result?.item) {
        setLibrary((current) => ({
          ...(current || {}),
          items: (current?.items || []).map((item) => item.id === result.item.id ? { ...item, ...result.item } : item),
        }));
      }
      if (result?.success === false) setError(result.error || "部分平台發布失敗，可只重試失敗平台。");
    } catch (caught) {
      setError(humanizeWorkflowError(caught.payload || { error: caught.message }));
    } finally {
      setBusyAction("");
    }
  }

  return (
    <section data-testid="version-workflow" hidden={hidden} aria-hidden={hidden} className="studio-workflow">
      <div className="studio-control-panel">
        <div className="studio-section-heading">
          <span>VERSION VIDEO</span>
          <h1>版本更新</h1>
          <p>每次只選一則內容。預覽確認後，發布系統會沿用同一份渲染成品。</p>
        </div>

        <Tabs value={mode} onValueChange={setMode} className="studio-mode-tabs">
          <TabsList aria-label="版本內容類型">
            {MODES.map((entry) => <TabsTrigger key={entry.id} value={entry.id}>{entry.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        <div className="studio-inline-actions">
          <Button variant="outline" onClick={scanVersion} disabled={busyAction !== "" || portfolioReadOnly}>
            <ScanSearch aria-hidden="true" />{busyAction === "scan" ? "掃描中…" : "掃描最新版本"}
          </Button>
          <Button variant="ghost" onClick={() => loadLibrary()} disabled={busyAction !== ""}>
            <RefreshCw aria-hidden="true" />重新載入
          </Button>
        </div>

        <div className="studio-content-list" aria-label="可製作內容">
          <div className="studio-content-list-heading"><Library aria-hidden="true" /><span>選擇一則內容</span><small>{visibleItems.length} 筆</small></div>
          {visibleItems.length > 0 ? visibleItems.slice(0, 12).map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              className="studio-content-option"
              data-selected={item.id === selectedItemId}
              onClick={() => { setSelectedItemId(item.id); setPreview(null); setPublishResult(null); }}
            >
              <span className="studio-option-copy"><strong>{itemTitle(item)}</strong><small>版本 {item.patchVersion || "最新"} · {item.category}</small></span>
              <span className="studio-option-status">{item.status || "READY"}</span>
            </Button>
          )) : (
            <div className="studio-list-empty">目前沒有可製作的內容，請先掃描最新版本。</div>
          )}
        </div>

        <Button className="studio-primary-action" onClick={createPreview} disabled={!selectedItem || !PUBLISHABLE.has(selectedItem.status || "READY") || busyAction !== "" || portfolioReadOnly}>
          <Sparkles aria-hidden="true" />{busyAction === "preview" ? "正在渲染影片…" : "產生影片預覽"}
        </Button>

        {portfolioReadOnly && <WorkflowStatus>目前是作品集唯讀模式，掃描、渲染與發布已停用。</WorkflowStatus>}
        {busyAction && <WorkflowStatus busy>正在處理，請保留這個頁面。</WorkflowStatus>}
        {error && <WorkflowStatus tone="error">{error}</WorkflowStatus>}
      </div>

      <PreviewPanel
        preview={preview}
        publishResult={publishResult}
        publishing={busyAction === "publish"}
        onPublish={publishPreview}
        onRetry={publishPreview}
        disabled={portfolioReadOnly}
      />
    </section>
  );
}
