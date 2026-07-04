"use client";

import { useMemo, useState } from "react";

const workspaces = [
  {
    id: "version",
    label: "版本改動工廠",
    status: "已支援",
    modes: [
      { id: "champion", label: "英雄改動", category: "CHAMPION", dataTypes: ["PATCH"], status: "已支援" },
      { id: "system", label: "系統改動", category: "SYSTEM", dataTypes: ["SYSTEM_UPDATE"], status: "已支援" },
      { id: "item-rune", label: "裝備 / 符文", category: "", dataTypes: ["ITEM_UPDATE", "RUNE_UPDATE"], status: "已支援" },
    ],
  },
  {
    id: "esports",
    label: "電競賽事工廠",
    status: "需補後端",
    modes: [
      { id: "daily", label: "每日系列賽", status: "部分已支援" },
      { id: "player", label: "選手雷達", status: "需補後端" },
    ],
  },
  {
    id: "publish",
    label: "發布與成效控制台",
    status: "已支援",
    modes: [
      { id: "queue", label: "發布佇列", status: "已支援" },
      { id: "insights", label: "洞察報表", status: "已支援" },
    ],
  },
  {
    id: "meta",
    label: "Meta 內容工廠",
    status: "已支援",
    modes: [
      { id: "offmeta", label: "黑科技", status: "已支援" },
      { id: "tier", label: "梯度榜單", status: "已支援" },
    ],
  },
];

const statusTone = {
  已支援: "ok",
  "部分已支援": "warn",
  需補後端: "need",
};

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function StatusBadge({ value }) {
  return <span className={`status ${statusTone[value] || "need"}`}>{value}</span>;
}

function WorkspaceNav({ active, setActive }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brandMark">HVS</span>
        <span>Hextech Video Studio</span>
      </div>
      <nav className="navList" aria-label="主工作區">
        {workspaces.map((workspace) => (
          <button
            key={workspace.id}
            type="button"
            className={`navItem ${active === workspace.id ? "active" : ""}`}
            onClick={() => setActive(workspace.id)}
          >
            <span>{workspace.label}</span>
            <StatusBadge value={workspace.status} />
          </button>
        ))}
      </nav>
    </aside>
  );
}

function TopBar({ workspace, busy }) {
  return (
    <header className="topbar">
      <div>
        <h1>{workspace.label}</h1>
        <p>{busy ? "執行中" : "待命"} · 工廠動作統一進佇列，正式發布由控制台接手</p>
      </div>
      <StatusBadge value={workspace.status} />
    </header>
  );
}

function ModeSwitch({ modes, active, setActive }) {
  return (
    <div className="segments" role="tablist">
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          role="tab"
          aria-selected={active === mode.id}
          className={active === mode.id ? "selected" : ""}
          onClick={() => setActive(mode.id)}
        >
          {mode.label}
          <StatusBadge value={mode.status} />
        </button>
      ))}
    </div>
  );
}

function getPreviewVideos(payload = {}) {
  return (Array.isArray(payload?.videos) ? payload.videos : [])
    .filter((video) => video?.videoUrl)
    .map((video, index) => ({
      ...video,
      label: video.label || (String(video.locale || "").toLowerCase().startsWith("en") ? "English" : "中文版"),
      key: video.videoUrl || video.fileName || `video-${index}`,
    }));
}

function getVersionItemTitle(item = {}) {
  return item.title || item.payload?.targetName || item.payload?.championName || item.targetName || item.id;
}

function extractRenderVideos(render = {}) {
  if (Array.isArray(render?.videos)) return render.videos;
  if (render?.videoUrl) return [{ locale: render.locale || "zh", label: render.label || "中文版", videoUrl: render.videoUrl, fileName: render.fileName }];
  return [];
}

function VideoPreview({ videos = [], empty = "" }) {
  if (videos.length === 0 && !empty) return null;

  return (
    <div className="videoPreview">
      <div className="videoPreviewHeader">
        <strong>影片預覽</strong>
        <span>{videos.length > 0 ? `${videos.length} 支已產出` : "尚無影片"}</span>
      </div>
      {videos.length > 0 ? (
        <div className="videoPreviewGrid">
          {videos.map((video) => (
            <article className="videoPreviewItem" key={video.key}>
              <video controls preload="metadata" src={video.videoUrl}>
                您的瀏覽器不支援影片預覽。
              </video>
              <div className="videoPreviewMeta">
                <div>
                  <strong>{video.label}</strong>
                  <span>{video.type || video.fileName || "rendered video"}</span>
                </div>
                <div className="videoPreviewActions">
                  <a href={video.videoUrl} target="_blank" rel="noreferrer">開新分頁</a>
                  <a href={video.videoUrl} download={video.fileName || true}>下載</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="videoPreviewEmpty">{empty}</div>
      )}
    </div>
  );
}

function ResultPanel({ title, payload, empty = "尚未執行", showPreview = true }) {
  const previewVideos = showPreview ? getPreviewVideos(payload) : [];

  return (
    <section className="panel resultPanel">
      <h2>{title}</h2>
      <VideoPreview videos={previewVideos} />
      {payload ? <pre>{JSON.stringify(payload, null, 2)}</pre> : <div className="empty">{empty}</div>}
    </section>
  );
}

const emptyMetaCandidates = { offmeta: [], tierRankings: [] };
const metaPositions = ["Top", "Jungle", "Mid", "ADC", "Support"];
const metaRegions = [
  { id: "global", label: "Global" },
  { id: "kr", label: "KR" },
  { id: "na", label: "NA" },
  { id: "euw", label: "EUW" },
  { id: "tw", label: "TW" },
];
const metaQueues = [
  { id: "ranked_solo_duo", label: "Ranked Solo/Duo" },
  { id: "ranked_flex", label: "Ranked Flex" },
];
const metaRankPresets = [
  { id: "emerald_plus", label: "Emerald+" },
  { id: "diamond_plus", label: "Diamond+" },
  { id: "master_plus", label: "Master+" },
  { id: "all_ranks", label: "All ranks" },
];
const metaRoleLabels = {
  Top: "上路",
  Jungle: "打野",
  Mid: "中路",
  ADC: "下路",
  Support: "輔助",
};
const metaOffmetaTypeLabels = {
  OFFROLE_PICK: "非主流位置",
  OFFMETA_BUILD: "出裝 / 符文黑科技",
};
const metaRiskLabels = {
  LOW_SAMPLE: "樣本偏低",
  LOW_PICK_RATE: "登場率偏低",
  SOURCE_MISMATCH: "資料源不一致",
  SOURCE_UNAVAILABLE: "資料來源未驗證",
  HIGH_ELO_ONLY: "高端局限定",
  NO_MAJOR_RISK: "暫無主要風險",
};
const metaHardBlockReasonLabels = {
  "Missing champion or role.": "缺少英雄或位置",
  "Sample size is below minimum threshold.": "樣本低於最低門檻",
  "Win rate is below baseline.": "勝率低於基準",
  "Source mismatch with low sample.": "資料源不一致且樣本偏低",
  "Tier ranking has no entries.": "梯度榜沒有可用排名",
  "缺少核心裝備/符文，不能生成黑科技影片。": "缺少核心裝備/符文，不能生成黑科技影片。",
};

const missingMetaGameplayReason = "缺少核心裝備/符文，不能生成黑科技影片。";

function getMetaCandidatePool(candidates = emptyMetaCandidates, mode = "offmeta") {
  return mode === "tier" ? candidates.tierRankings || [] : candidates.offmeta || [];
}

function parseMetaExcludedChampions(value = "") {
  return value
    .split(/[,\n]/)
    .map((champion) => champion.trim())
    .filter(Boolean);
}

function getMetaCandidateId(candidate = {}) {
  return candidate.candidateId || candidate.role || "";
}

function hasMetaBuildDetails(candidate = {}) {
  return (
    (Array.isArray(candidate.coreItems) && candidate.coreItems.length > 0) ||
    (Array.isArray(candidate.coreRunes) && candidate.coreRunes.length > 0)
  );
}

function isRenderableMetaCandidate(candidate = {}) {
  if (!getMetaCandidateId(candidate) || candidate.hardBlock?.blocked) return false;
  if (candidate.kind === "META_OFFMETA_PICK" && candidate.offmetaType === "OFFMETA_BUILD" && !hasMetaBuildDetails(candidate)) return false;
  return candidate.kind !== "META_TIER_RANKING" || (Array.isArray(candidate.entries) && candidate.entries.length > 0);
}

function formatMetaCoreGameplay(candidate = {}) {
  if (candidate.kind === "META_TIER_RANKING") return "";
  const coreItems = Array.isArray(candidate.coreItems) ? candidate.coreItems : [];
  const coreRunes = Array.isArray(candidate.coreRunes) ? candidate.coreRunes : [];
  const coreNames = [...coreItems, ...coreRunes].map((option) => option?.name).filter(Boolean).slice(0, 3);

  if (coreNames.length > 0) return `核心玩法：${coreNames.join(" / ")}`;
  if (candidate.offmetaType === "OFFROLE_PICK") return "核心玩法：位置本身是黑科技，先看對線情境";
  return missingMetaGameplayReason;
}

function getMetaRenderBlockReasons(candidate = {}) {
  const hardBlockReasons = candidate.hardBlock?.reasons || [];
  if (candidate.kind === "META_OFFMETA_PICK" && candidate.offmetaType === "OFFMETA_BUILD" && !hasMetaBuildDetails(candidate)) {
    return hardBlockReasons.includes(missingMetaGameplayReason) ? hardBlockReasons : [...hardBlockReasons, missingMetaGameplayReason];
  }
  return hardBlockReasons;
}

function getMetaRoleLabel(role = "") {
  return metaRoleLabels[role] || role || "未指定位置";
}

function formatMetaOffmetaType(type = "") {
  return metaOffmetaTypeLabels[type] || "非主流題材";
}

function formatMetaRiskLabel(label = "") {
  return metaRiskLabels[label] || label || "風險未標記";
}

function formatMetaHardBlockReason(reason = "") {
  return metaHardBlockReasonLabels[reason] || reason || "未提供阻擋原因";
}

function getMetaCandidateTitle(candidate = {}) {
  if (candidate.kind === "META_TIER_RANKING") return `${getMetaRoleLabel(candidate.role || "All")} 梯度榜單`;
  return [candidate.champion, getMetaRoleLabel(candidate.role)].filter(Boolean).join(" ") || candidate.candidateId || "未命名候選";
}

function getMetaCandidateSubtitle(candidate = {}) {
  if (candidate.kind === "META_TIER_RANKING") {
    const topPick = candidate.entries?.[0]?.champion ? `#1 ${candidate.entries[0].champion}` : "無可用排名";
    return `${topPick} · ${candidate.rankingSize || candidate.entries?.length || 0} 個候選`;
  }
  return `${formatMetaOffmetaType(candidate.offmetaType)} · ${formatMetaCoreGameplay(candidate)} · 樣本 ${candidate.sampleSize || 0}`;
}

function VersionFactory() {
  const [mode, setMode] = useState("champion");
  const [library, setLibrary] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const activeMode = workspaces[0].modes.find((item) => item.id === mode);
  const versionItems = (library?.items || []).filter((item) => activeMode.dataTypes.includes(item.payload?.dataType));
  const selectedItems = versionItems.filter((item) => selectedItemIds.includes(item.id));
  const selectedItem = selectedItems[0] || null;
  const versionPreviewVideos = getPreviewVideos(result);

  const selectFirstAvailableItem = (items, modeConfig = activeMode) => {
    const filteredItems = (items || []).filter((item) => modeConfig.dataTypes.includes(item.payload?.dataType));
    setSelectedItemIds((currentIds) => {
      const visibleIds = new Set(filteredItems.map((item) => item.id));
      const retainedIds = currentIds.filter((id) => visibleIds.has(id));
      return retainedIds.length > 0 ? retainedIds : filteredItems[0]?.id ? [filteredItems[0].id] : [];
    });
    return filteredItems;
  };

  const switchVersionMode = (nextMode) => {
    const modeConfig = workspaces[0].modes.find((item) => item.id === nextMode) || workspaces[0].modes[0];
    setMode(nextMode);
    selectFirstAvailableItem(library?.items || [], modeConfig);
  };

  function toggleVersionItemSelection(itemId) {
    setSelectedItemIds((currentIds) => (
      currentIds.includes(itemId)
        ? currentIds.filter((id) => id !== itemId)
        : [...currentIds, itemId]
    ));
  }

  function selectVisibleVersionItems() {
    setSelectedItemIds(versionItems.map((item) => item.id));
  }

  function clearSelectedVersionItems() {
    setSelectedItemIds([]);
  }

  const loadLibrary = async () => {
    setBusy(true);
    setResult(null);
    try {
      const params = new URLSearchParams();
      if (activeMode.category) params.set("category", activeMode.category);
      const response = await fetch(`/api/content-factory/library?${params.toString()}`);
      const json = await response.json();
      const filteredItems = selectFirstAvailableItem(json.items || []);
      setLibrary({ ...json, items: json.items || [] });
      setResult({ action: "library", count: filteredItems.length, stats: json.stats });
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setBusy(false);
    }
  };

  const scanPatch = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/content-factory/scan", { method: "POST", body: JSON.stringify({ projectId: "lol" }) });
      const json = await response.json();
      const filteredItems = selectFirstAvailableItem(json.items || []);
      setLibrary({ ...json, items: json.items || [] });
      setResult({ action: "scan", inserted: json.inserted, updated: json.updated, stats: json.stats, scanStats: json.scanStats, scannedPatchVersion: json.scannedPatchVersion });
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setBusy(false);
    }
  };

  async function renderSelectedVersionItem() {
    if (!selectedItem) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/content-factory/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItem.id, render: true }),
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.error || "Content render failed.");
      const videos = extractRenderVideos(payload.render);
      setResult({ action: "render", ...payload, videos });
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function publishSelectedVersionItem() {
    if (selectedItemIds.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/content-factory/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "lol", itemIds: selectedItemIds, action: "publish" }),
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.error || "Content publish failed.");
      const videos = (payload.results || []).flatMap((entry) => extractRenderVideos(entry.render));
      const updatedItems = new Map((payload.results || []).map((entry) => [entry.item?.id, entry.item]).filter(([id]) => id));
      if (updatedItems.size > 0) {
        setLibrary((current) => ({
          ...(current || {}),
          items: (current?.items || []).map((item) => updatedItems.get(item.id) || item),
        }));
      }
      setResult({ action: "publish", ...payload, videos });
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace">
      <TopBar workspace={workspaces[0]} busy={busy} />
      <ModeSwitch modes={workspaces[0].modes} active={mode} setActive={switchVersionMode} />
      <div className="grid">
        <section className="panel actionPanel">
          <h2>工廠操作</h2>
          <div className="fieldGrid">
            <label>
              目前模式
              <strong>{activeMode.label}</strong>
            </label>
            <label>
              後端狀態
              <StatusBadge value={activeMode.status} />
            </label>
          </div>
          <div className="buttonRow">
            <button type="button" onClick={scanPatch} disabled={busy}>掃描版本內容</button>
            <button type="button" onClick={loadLibrary} disabled={busy}>重新載入內容庫</button>
            <button type="button" onClick={selectVisibleVersionItems} disabled={busy || versionItems.length === 0}>選取全部</button>
            <button type="button" onClick={clearSelectedVersionItems} disabled={busy || selectedItemIds.length === 0}>清除選取</button>
            <button type="button" onClick={renderSelectedVersionItem} disabled={busy || !selectedItem}>生產影片</button>
            <button type="button" onClick={publishSelectedVersionItem} disabled={busy || selectedItemIds.length === 0}>一鍵發布選取影片</button>
          </div>
          {selectedItem ? (
            <div className="selectedBlockState clear">
              <strong>已選 {selectedItemIds.length} 筆內容</strong>
              <span>{getVersionItemTitle(selectedItem)}{selectedItemIds.length > 1 ? ` 等 ${selectedItemIds.length} 筆` : ""} · {selectedItem.patchVersion || "latest"} · {selectedItem.status || "READY"}</span>
            </div>
          ) : (
            <div className="selectedBlockState">
              <strong>尚未選取內容</strong>
              <span>先掃描或載入內容庫，再選一筆內容生成或發布。</span>
            </div>
          )}
          <VideoPreview videos={versionPreviewVideos} empty="尚無影片" />
        </section>
        <section className="panel listPanel">
          <h2>內容庫</h2>
          {versionItems.length > 0 ? (
            <div className="table">
              {versionItems.slice(0, 12).map((item) => (
                <button
                  type="button"
                  className={`row contentRow ${selectedItemIds.includes(item.id) ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => toggleVersionItemSelection(item.id)}
                >
                  <span className="selectMark" aria-hidden="true">{selectedItemIds.includes(item.id) ? "ON" : ""}</span>
                  <span>{getVersionItemTitle(item)}</span>
                  <code>{item.payload?.dataType}</code>
                  <StatusBadge value={item.status || "READY"} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">沒有符合此模式的內容。可先掃描版本資料或切換模式。</div>
          )}
        </section>
        <ResultPanel title="預覽 / 發布狀態" payload={result} />
      </div>
    </main>
  );
}

function MetaFactory() {
  const metaWorkspace = workspaces.find((item) => item.id === "meta");
  const [metaMode, setMetaMode] = useState("offmeta");
  const [metaPatch, setMetaPatch] = useState("16.12");
  const [metaRegion, setMetaRegion] = useState("global");
  const [metaQueue, setMetaQueue] = useState("ranked_solo_duo");
  const [metaRankPreset, setMetaRankPreset] = useState("emerald_plus");
  const [metaExcludedChampions, setMetaExcludedChampions] = useState("");
  const [metaPosition, setMetaPosition] = useState("Mid");
  const [metaSnapshotId, setMetaSnapshotId] = useState("");
  const [metaCandidates, setMetaCandidates] = useState(emptyMetaCandidates);
  const [metaSelectedCandidateId, setMetaSelectedCandidateId] = useState("");
  const [metaSourceStatus, setMetaSourceStatus] = useState(null);
  const [metaResult, setMetaResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const activeMetaMode = metaWorkspace.modes.find((item) => item.id === metaMode) || metaWorkspace.modes[0];
  const metaCandidatePool = getMetaCandidatePool(metaCandidates, metaMode);
  const metaRenderableCandidatePool = metaCandidatePool.filter(isRenderableMetaCandidate);
  const metaBlockedCandidatePool = metaCandidatePool.filter((candidate) => !isRenderableMetaCandidate(candidate));
  const hasRenderableMetaCandidate = metaRenderableCandidatePool.length > 0;
  const selectedMetaCandidate = metaCandidatePool.find((candidate) => getMetaCandidateId(candidate) === metaSelectedCandidateId);
  const selectedMetaBlockReasons = getMetaRenderBlockReasons(selectedMetaCandidate);
  const selectedMetaCandidateBlocked = selectedMetaCandidate ? !isRenderableMetaCandidate(selectedMetaCandidate) : false;
  const primarySource = metaSourceStatus?.primary;
  const verifierSource = metaSourceStatus?.verifier;
  const metaPreviewVideos = getPreviewVideos(metaResult);

  const selectFirstCandidate = (candidates, mode) => {
    const pool = getMetaCandidatePool(candidates, mode);
    const candidate = pool.find(isRenderableMetaCandidate);
    setMetaSelectedCandidateId(getMetaCandidateId(candidate));
  };

  const switchMetaMode = (nextMode) => {
    setMetaMode(nextMode);
    selectFirstCandidate(metaCandidates, nextMode);
  };

  async function scanMetaFactory() {
    setBusy(true);
    setMetaResult(null);
    try {
      const response = await fetch("/api/meta-factory/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patch: metaPatch,
          region: metaRegion,
          queue: metaQueue,
          rankPreset: metaRankPreset,
          position: metaPosition,
          mode: metaMode,
          excludedChampions: parseMetaExcludedChampions(metaExcludedChampions),
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.error || "Meta scan failed.");
      const nextCandidates = payload.candidates || emptyMetaCandidates;
      setMetaSnapshotId(payload.snapshotId || "");
      setMetaCandidates(nextCandidates);
      setMetaSourceStatus(payload.sourceStatus || null);
      selectFirstCandidate(nextCandidates, metaMode);
      setMetaResult(payload);
    } catch (error) {
      setMetaResult({ success: false, error: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function loadMetaSnapshot() {
    if (!metaSnapshotId) {
      setMetaResult({ success: false, error: "請先輸入或產生 snapshotId。" });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/meta-factory/snapshot?snapshotId=${encodeURIComponent(metaSnapshotId)}`);
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.error || "Meta snapshot load failed.");
      const nextCandidates = payload.candidates || emptyMetaCandidates;
      setMetaCandidates(nextCandidates);
      setMetaSourceStatus(payload.sourceStatus || null);
      selectFirstCandidate(nextCandidates, metaMode);
      setMetaResult(payload);
    } catch (error) {
      setMetaResult({ success: false, error: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function renderMetaCandidate({ useTopCandidate = false } = {}) {
    if (!metaSnapshotId) {
      setMetaResult({ success: false, error: "請先完成 Meta 掃描。" });
      return;
    }
    if (!useTopCandidate && !metaSelectedCandidateId) {
      setMetaResult({ success: false, error: "請先選擇候選題材。" });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/meta-factory/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: metaSnapshotId,
          mode: metaMode,
          candidateId: metaSelectedCandidateId,
          useTopCandidate,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.error || "Meta render failed.");
      setMetaResult(payload);
    } catch (error) {
      setMetaResult({ success: false, error: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace">
      <TopBar workspace={metaWorkspace} busy={busy} />
      <ModeSwitch modes={metaWorkspace.modes} active={metaMode} setActive={switchMetaMode} />
      <div className="grid">
        <section className="panel actionPanel">
          <h2>Meta 生成控制</h2>
          <div className="fieldGrid">
            <label>
              模式
              <strong>{activeMetaMode.label}</strong>
            </label>
            <label>
              後端狀態
              <StatusBadge value={activeMetaMode.status} />
            </label>
            <label>
              Patch
              <input value={metaPatch} onChange={(event) => setMetaPatch(event.target.value)} placeholder="16.12" />
            </label>
            <label>
              Region
              <select value={metaRegion} onChange={(event) => setMetaRegion(event.target.value)}>
                {metaRegions.map((region) => <option key={region.id} value={region.id}>{region.label}</option>)}
              </select>
            </label>
            <label>
              Queue
              <select value={metaQueue} onChange={(event) => setMetaQueue(event.target.value)}>
                {metaQueues.map((queue) => <option key={queue.id} value={queue.id}>{queue.label}</option>)}
              </select>
            </label>
            <label>
              Rank preset
              <select value={metaRankPreset} onChange={(event) => setMetaRankPreset(event.target.value)}>
                {metaRankPresets.map((rank) => <option key={rank.id} value={rank.id}>{rank.label}</option>)}
              </select>
            </label>
            <label>
              位置
              <select value={metaPosition} onChange={(event) => setMetaPosition(event.target.value)}>
                {metaPositions.map((position) => <option key={position}>{position}</option>)}
              </select>
            </label>
            <label className="wideField">
              排除英雄
              <input value={metaExcludedChampions} onChange={(event) => setMetaExcludedChampions(event.target.value)} placeholder="Yone, Yasuo 或一行一個英雄" />
            </label>
            <label className="wideField">
              snapshotId
              <input value={metaSnapshotId} onChange={(event) => setMetaSnapshotId(event.target.value)} placeholder="掃描後自動帶入，可貼上重載" />
            </label>
            <label>
              Source status
              <span className="sourceLine">
                <strong>{primarySource?.provider || "LoLalytics"}</strong>
                <span>{primarySource?.status || "未掃描"}</span>
              </span>
            </label>
            <label>
              Verifier
              <span className="sourceLine">
                <strong>{verifierSource?.provider || "OP.GG"}</strong>
                <span>{verifierSource?.status || "未檢查"}</span>
              </span>
            </label>
          </div>
          <div className="buttonRow">
            <button type="button" onClick={scanMetaFactory} disabled={busy}>1 掃描候選</button>
            <button type="button" onClick={loadMetaSnapshot} disabled={busy || !metaSnapshotId}>載入舊掃描</button>
            <button type="button" onClick={() => renderMetaCandidate({ useTopCandidate: true })} disabled={busy || !metaSnapshotId || !hasRenderableMetaCandidate}>2 生成推薦影片</button>
            <button type="button" onClick={() => renderMetaCandidate()} disabled={busy || !metaSnapshotId || !metaSelectedCandidateId || selectedMetaCandidate?.hardBlock?.blocked || selectedMetaCandidateBlocked}>2 生成選取影片</button>
          </div>
          <VideoPreview videos={metaPreviewVideos} empty="尚無影片" />
          {!hasRenderableMetaCandidate && metaCandidatePool.length > 0 ? (
            <div className="selectedBlockState">
              <strong>目前沒有可生成題材</strong>
              <span>主清單已隱藏不符合黑科技條件的候選。</span>
            </div>
          ) : selectedMetaCandidateBlocked ? (
            <div className="selectedBlockState">
              <strong>選取題材被阻擋</strong>
              <span>{selectedMetaBlockReasons.map(formatMetaHardBlockReason).join("、") || "未提供阻擋原因"}</span>
            </div>
          ) : (
            <div className="selectedBlockState clear">
              <strong>選取題材可生成</strong>
              <span>推薦生成會自動跳過被阻擋的候選。</span>
            </div>
          )}
        </section>
        <section className="panel listPanel">
          <h2>候選題材</h2>
          {metaRenderableCandidatePool.length > 0 ? (
            <div className="table">
              {metaRenderableCandidatePool.slice(0, 12).map((candidate) => {
                const candidateId = getMetaCandidateId(candidate);
                const riskLabels = candidate.riskLabels || [];
                const hardBlockReasons = candidate.hardBlock?.reasons || [];
                const renderBlockReasons =
                  candidate.kind === "META_OFFMETA_PICK" && candidate.offmetaType === "OFFMETA_BUILD" && !hasMetaBuildDetails(candidate)
                    ? (hardBlockReasons.includes(missingMetaGameplayReason) ? hardBlockReasons : [...hardBlockReasons, missingMetaGameplayReason])
                    : hardBlockReasons;
                const renderable = isRenderableMetaCandidate(candidate);
                return (
                  <button
                    type="button"
                    key={candidateId || getMetaCandidateTitle(candidate)}
                    className={`candidateRow ${metaSelectedCandidateId === candidateId ? "selected" : ""}`}
                    onClick={() => setMetaSelectedCandidateId(candidateId)}
                  >
                    <span className="candidateMain">
                      <strong>{getMetaCandidateTitle(candidate)}</strong>
                      <span>{getMetaCandidateSubtitle(candidate)}</span>
                    </span>
                    <span className="candidateMeta">
                      <span className="coreGameplay">{formatMetaCoreGameplay(candidate) || `榜首分數：${candidate.entries?.[0]?.tierScore ?? "n/a"}`}</span>
                      <span className="riskList">
                        {riskLabels.length > 0
                          ? riskLabels.map((label) => <span className="riskTag" key={label}>{formatMetaRiskLabel(label)}</span>)
                          : <span className="riskTag clearTag">暫無主要風險</span>}
                      </span>
                      <span className={`hardBlock ${renderable ? "clear" : "blocked"}`}>
                        {renderBlockReasons.length > 0
                          ? `已阻擋：${renderBlockReasons.map(formatMetaHardBlockReason).join("、")}`
                          : "可生成"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : metaCandidatePool.length > 0 ? (
            <div className="empty">
              目前沒有可生成的黑科技題材。正常位置但缺少核心裝備/符文的列已隱藏；請換位置、分段，或等裝備與符文詳情來源可用。
            </div>
          ) : (
            <div className="empty">尚無候選題材。掃描來源或載入 snapshot 後會顯示風險標籤與 hard blocks。</div>
          )}
          {metaBlockedCandidatePool.length > 0 ? (
            <details className="blockedCandidateDetails">
              <summary>已隱藏 {metaBlockedCandidatePool.length} 個不符合條件的候選</summary>
              <div className="blockedCandidateList">
                {metaBlockedCandidatePool.slice(0, 6).map((candidate) => (
                  <span key={getMetaCandidateId(candidate) || getMetaCandidateTitle(candidate)}>
                    {getMetaCandidateTitle(candidate)}：{getMetaRenderBlockReasons(candidate).map(formatMetaHardBlockReason).join("、") || "不符合可生成條件"}
                  </span>
                ))}
              </div>
            </details>
          ) : null}
        </section>
        <ResultPanel title="Render / Queue 紀錄" payload={metaResult} empty="掃描、載入 snapshot 或 render 後會顯示原始回應。" showPreview={false} />
      </div>
    </main>
  );
}

function EsportsFactory() {
  const [mode, setMode] = useState("daily");
  const [date, setDate] = useState(() => getLocalDateInputValue());
  const [scanId, setScanId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const scanCandidates = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/esports/candidates", {
        method: "POST",
        body: JSON.stringify({ date, activeMode: mode, languages: ["zh", "en"], tournamentScope: "configured" }),
      });
      const json = await response.json();
      setScanId(json.scanId || "");
      setSeriesId(json.candidates?.[0]?.seriesId || "");
      setResult(json);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setBusy(false);
    }
  };

  const checkGate = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/esports/daily", {
        method: "POST",
        body: JSON.stringify({ scanId, seriesId, dryRun: true, languages: ["zh", "en"] }),
      });
      setResult(await response.json());
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setBusy(false);
    }
  };

  const runPlayerRadar = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/esports/player-radar", {
        method: "POST",
        body: JSON.stringify({ scanId, seriesId, playerName: playerName || undefined, languages: ["zh", "en"] }),
      });
      setResult(await response.json());
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="workspace">
      <TopBar workspace={workspaces[1]} busy={busy} />
      <ModeSwitch modes={workspaces[1].modes} active={mode} setActive={setMode} />
      <div className="grid">
        <section className="panel actionPanel">
          <h2>共用賽事資料</h2>
          <div className="fieldGrid">
            <label>
              日期
              <input value={date} type="date" onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              scanId
              <input value={scanId} onChange={(event) => setScanId(event.target.value)} placeholder="掃描後自動帶入" />
            </label>
            <label>
              seriesId
              <input value={seriesId} onChange={(event) => setSeriesId(event.target.value)} placeholder="選擇或貼上 seriesId" />
            </label>
            <label>
              playerName
              <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="空白則使用推薦 MVP" />
            </label>
          </div>
          <div className="buttonRow">
            <button type="button" onClick={scanCandidates} disabled={busy}>掃描候選賽事</button>
            <button type="button" onClick={checkGate} disabled={busy || !scanId || !seriesId}>檢查 Gate</button>
            <button type="button" onClick={runPlayerRadar} disabled={busy || !scanId || !seriesId}>產生選手雷達</button>
          </div>
        </section>
        <section className="panel">
          <h2>資料契約</h2>
          <div className="contractList">
            <div><span>Candidates scan</span><StatusBadge value="需補後端" /></div>
            <div><span>Daily Gate first</span><StatusBadge value="部分已支援" /></div>
            <div><span>Player Radar runner</span><StatusBadge value="需補後端" /></div>
            <div><span>Queue handoff</span><StatusBadge value="已支援" /></div>
          </div>
        </section>
        <ResultPanel title="候選 / Gate / Render 結果" payload={result} empty="Leaguepedia 無資料時會顯示空狀態或錯誤，不使用 sample mode。" />
      </div>
    </main>
  );
}

function PublishConsole() {
  const [jobs, setJobs] = useState(null);
  const [insights, setInsights] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadQueue = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/publish?status=QUEUED");
      setJobs(await response.json());
    } finally {
      setBusy(false);
    }
  };

  const loadInsights = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/insights");
      setInsights(await response.json());
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="workspace">
      <TopBar workspace={workspaces[2]} busy={busy} />
      <ModeSwitch modes={workspaces[2].modes} active="queue" setActive={() => {}} />
      <div className="grid">
        <section className="panel actionPanel">
          <h2>IG / Threads 控制</h2>
          <div className="platformGrid">
            <div><strong>IG</strong><StatusBadge value="已支援" /></div>
            <div><strong>Threads</strong><StatusBadge value="已支援" /></div>
          </div>
          <div className="buttonRow">
            <button type="button" onClick={loadQueue} disabled={busy}>查看發布佇列</button>
            <button type="button" onClick={loadInsights} disabled={busy}>同步成效檢視</button>
          </div>
        </section>
        <ResultPanel title="發布佇列" payload={jobs} />
        <ResultPanel title="洞察報表" payload={insights} />
      </div>
    </main>
  );
}

export default function HomePage() {
  const [active, setActive] = useState("version");
  const workspace = useMemo(() => workspaces.find((item) => item.id === active) || workspaces[0], [active]);

  return (
    <div className="hvsShell">
      <WorkspaceNav active={active} setActive={setActive} />
      {workspace.id === "version" ? <VersionFactory /> : null}
      {workspace.id === "esports" ? <EsportsFactory /> : null}
      {workspace.id === "publish" ? <PublishConsole /> : null}
      {workspace.id === "meta" ? <MetaFactory /> : null}
    </div>
  );
}
