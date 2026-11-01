"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { ExternalLink, FileCheck, Film, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowStatus } from "./WorkflowStatus";
import { canConfirmStory, initialStoryEditor, isStoryConfirmed, safeStorySourceUrl, storyEditorReducer } from "./matchStoryModel";

const sourceLabels = { report: "報導內容", "reviewed-video": "人工回看", stats: "比賽數據", "search-lead": "待查證線索" };

export function MatchStoryPanel({ scanId, selected, disabled = false }) {
  const [editor, dispatch] = useReducer(storyEditorReducer, initialStoryEditor);
  const [busy, setBusy] = useState("");
  const [draftId, setDraftId] = useState("");
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const unavailable = disabled || !!busy;
  const candidate = editor.draft?.research.candidates.find(item => item.id === editor.selectedCandidateId);

  async function operate(action, body) {
    if (locked.current || disabled) return;
    locked.current = true;
    setBusy(action);
    dispatch({ type: "error", message: "" });
    try {
      const response = await fetch("/api/esports/story", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }),
      });
      const result = await response.json().catch(() => { throw new Error("伺服器回應無法讀取，請重試。"); });
      if (!response.ok || result.success !== true) throw new Error(result.message || "操作失敗，請重試。");
      if (result.draft.identity.scanId !== scanId || result.draft.identity.seriesId !== selected.seriesId) throw new Error("這份草稿不屬於所選比賽，請重新選擇。");
      if (mounted.current) {
        dispatch({ type: "loaded", draft: result.draft });
        setDraftId(result.draft.id);
      }
    } catch (error) {
      if (mounted.current) dispatch({ type: "error", message: error.message === "Failed to fetch" ? "連線中斷，稿件文字仍保留，請重試。" : error.message });
    } finally {
      locked.current = false;
      if (mounted.current) setBusy("");
    }
  }

  async function importResearch(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || locked.current || disabled) return;
    if (file.size > 900000) { dispatch({ type: "error", message: "研究資料過大，請使用小於 900 KB 的 JSON 檔。" }); return; }
    try {
      const research = JSON.parse(await file.text());
      await operate("import", { scanId, seriesId: selected.seriesId, research });
    } catch { dispatch({ type: "error", message: "無法讀取研究資料，請選擇有效的 JSON 檔。" }); }
  }

  function editSegment(index, patch) {
    dispatch({ type: "edit", segments: editor.segments.map((segment, i) => i === index ? { ...segment, ...patch } : segment) });
  }
  const versioned = editor.draft && { id: editor.draft.id, expectedRevision: editor.draft.revision };

  async function makePreview() {
    if (locked.current || disabled || !isStoryConfirmed(editor)) return;
    locked.current = true;
    setBusy("preview");
    dispatch({ type: "error", message: "" });
    try {
      const response = await fetch("/api/esports/story/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...versioned, scanId, seriesId: selected.seriesId }),
      });
      const result = await response.json().catch(() => { throw new Error("伺服器回應無法讀取，請重試。"); });
      if (!response.ok || result.success !== true) throw new Error(result.message || "預覽製作失敗，稿件仍保留。");
      if (mounted.current) dispatch({ type: "preview", preview: result.preview });
    } catch (error) {
      if (mounted.current) dispatch({ type: "error", message: error.message === "Failed to fetch" ? "連線中斷，稿件仍保留。請先確認製作狀態，再重試。" : error.message });
    } finally {
      locked.current = false;
      if (mounted.current) setBusy("");
    }
  }

  return <section data-testid="match-story-panel" className="studio-story-panel" aria-labelledby="story-heading">
    <header className="studio-story-heading">
      <div><h2 id="story-heading">這場比賽，要說哪個故事？</h2>
        <p>{selected.teamA} vs {selected.teamB}<br /><time className="studio-story-date" dateTime={selected.date}>{selected.date}</time> · {selected.seriesScore || selected.score}</p></div>
      <p role="status" className="studio-story-version">{editor.dirty ? "有未保存修改，請先保存再確認" : isStoryConfirmed(editor)
        ? `第 ${editor.draft.revision} 版已確認，待製作預覽` : editor.draft ? `第 ${editor.draft.revision} 版 · 草稿未確認` : "尚未匯入研究資料"}</p>
    </header>
    <p className="studio-story-note">自動研究停用，避免新增服務費。匯入已核對的研究檔後，先確認來源與腳本；這裡不會發文。</p>
    <div className="studio-story-import studio-field">
      <label htmlFor="story-research-file">匯入研究資料</label>
      <Input id="story-research-file" type="file" accept="application/json,.json" onChange={importResearch} disabled={unavailable} />
      <p className="studio-story-note">只收本場所用的研究 JSON，不要放帳密、金鑰或登入網址。</p>
    </div>
    <details className="studio-story-restore"><summary>讀回已保存草稿</summary>
      <div className="studio-field"><label htmlFor="story-draft-id">草稿編號</label><Input id="story-draft-id" value={draftId} onChange={event => setDraftId(event.target.value)} disabled={unavailable} /></div>
      <p className="studio-story-note">讀回最新版本會取代本頁未保存的編輯，不會修改已保存的稿件。請先複製需要保留的文字。</p>
      <Button variant="outline" className="studio-primary-action" disabled={unavailable || !draftId}
        onClick={() => operate("read", { id: draftId })}>讀回最新版本</Button>
    </details>
    {busy && <WorkflowStatus busy>正在{busy === "import" ? "匯入資料" : busy === "read" ? "讀回稿件" : busy === "confirm" ? "確認版本" : busy === "preview" ? "製作影片，請留在此頁等候；不會發文" : "保存稿件"}…</WorkflowStatus>}
    {editor.error && <WorkflowStatus tone="error">{editor.error} 未保存文字仍保留。</WorkflowStatus>}
    {editor.draft && <nav aria-label="稿件導覽" className="studio-story-nav">
      <Button asChild variant="outline"><a href="#story-candidates">選擇看點</a></Button>
      {candidate && <Button asChild variant="outline"><a href="#story-script">編輯腳本</a></Button>}
      <Button asChild variant="ghost"><a href="#story-sources">來源與證據</a></Button>
    </nav>}
    {editor.draft && <div className="studio-story-columns">
      <aside className="studio-story-research" aria-label="來源與證據">
        <h3 id="story-sources" tabIndex={-1}>來源與證據</h3>
        <ul className="studio-story-source-list">{editor.draft.research.sources.map(source => {
          const href = safeStorySourceUrl(source.url);
          return <li key={source.id}>
            <strong>{source.title}</strong><span>{sourceLabels[source.readStatus]}</span><p>{source.matchExplanation}</p>
            {href ? <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">查看來源<ExternalLink aria-hidden="true" /></a> : <span>連結不安全，未提供開啟入口</span>}
          </li>;
        })}</ul>
        <ul className="studio-story-fact-list">{editor.draft.research.facts.map(fact => <li key={fact.id}>
          <p>{fact.statement}</p><span>{fact.scope === "series" ? "整個系列賽" : fact.scope === "background" ? "背景" : `第 ${fact.gameNumber || "未標示"} 局`} · {sourceLabels[fact.evidenceType]}</span>
          <p>來源：{fact.sourceIds.map(id => editor.draft.research.sources.find(source => source.id === id)?.title).join("、")}</p>
          {fact.limitations.map((text, i) => <p key={i}>限制：{text}</p>)}
          {fact.conflicts.map((text, i) => <p key={i}>衝突：{text}</p>)}
        </li>)}</ul>
      </aside>
      <div className="studio-story-editor">
        <h3 id="story-candidates" tabIndex={-1}>選一條主線</h3>
        {editor.draft.research.candidates.length === 0 && <WorkflowStatus>這份資料還沒有可靠看點。請補研究資料，不會自動編造故事。</WorkflowStatus>}
        {editor.draft.research.candidates.map(item => <div className="studio-story-candidate" key={item.id}>
          <h4>{item.headline}</h4><p>{item.whyInteresting}</p>
          {item.unresolved.map((text, i) => <p key={i}>待確認：{text}</p>)}
          <Button variant={item.id === editor.selectedCandidateId ? "secondary" : "outline"} className="studio-primary-action"
            aria-pressed={item.id === editor.selectedCandidateId} disabled={unavailable || item.id === editor.selectedCandidateId}
            onClick={() => dispatch({ type: "candidate", id: item.id })}>選用：{item.headline}</Button>
        </div>)}
        {candidate && <>
          <h3 id="story-script" tabIndex={-1} className="studio-story-script-title">編輯腳本</h3>
          <p className="studio-story-note">每段引用支撐這段話的事實；勾選引用不會自動證明文字正確。</p>
          {editor.segments.map((segment, index) => <fieldset className="studio-story-segment" key={index}>
            <legend>第 {index + 1} 段</legend>
            <label htmlFor={`story-narration-${index}`}>第 {index + 1} 段旁白</label>
            <Textarea id={`story-narration-${index}`} value={segment.narration} maxLength={2000} rows={4} disabled={unavailable}
              onChange={event => editSegment(index, { narration: event.target.value })} />
            <div className="studio-story-evidence-choice">{editor.draft.research.facts.map(fact => <label key={fact.id}>
              <Input type="checkbox" checked={segment.factIds.includes(fact.id)} disabled={unavailable}
                aria-label={`第 ${index + 1} 段證據：${fact.statement}`}
                onChange={event => editSegment(index, { factIds: event.target.checked ? [...segment.factIds, fact.id] : segment.factIds.filter(id => id !== fact.id) })} />
              <span>{fact.statement}</span></label>)}</div>
            <Button variant="ghost" disabled={unavailable} onClick={() => dispatch({ type: "edit", segments: editor.segments.filter((_, i) => i !== index) })}>
              <Trash2 aria-hidden="true" />移除第 {index + 1} 段</Button>
          </fieldset>)}
          <Button variant="outline" className="studio-primary-action" disabled={unavailable || editor.segments.length >= 20}
            onClick={() => dispatch({ type: "edit", segments: [...editor.segments, { narration: "", factIds: [] }] })}><Plus aria-hidden="true" />新增段落</Button>
          <div className="studio-story-actions">
            <Button className="studio-primary-action" disabled={unavailable || !editor.dirty} onClick={() => operate("revise", { ...versioned, patch: { selectedCandidateId: editor.selectedCandidateId, segments: editor.segments } })}><Save aria-hidden="true" />保存稿件</Button>
            <Button variant="outline" className="studio-primary-action" disabled={unavailable || !canConfirmStory(editor) || isStoryConfirmed(editor)} onClick={() => operate("confirm", versioned)}><FileCheck aria-hidden="true" />確認這版稿件</Button>
          </div>
          <Button className="studio-primary-action" disabled={unavailable || !isStoryConfirmed(editor)} onClick={makePreview}><Film aria-hidden="true" />製作故事預覽</Button>
          <p className="studio-story-note">修改後須重新保存與確認。預覽使用已驗證的隊徽、示意地圖與免費筆觸，不使用比賽實況，不會發文。</p>
          {editor.preview && <section aria-labelledby="story-preview-heading">
            <h3 id="story-preview-heading">第 {editor.preview.revision} 版故事預覽</h3>
            <p className="studio-story-note">影片基本規格已通過；請播放檢查文字與節奏。預覽不等於授權發布。</p>
            <div className="studio-video-frame"><video data-testid="story-preview-video" src={editor.preview.videoUrl} controls playsInline preload="metadata"
              aria-label={`第 ${editor.preview.revision} 版故事影片`}
              onError={() => dispatch({ type: "error", message: "影片載入失敗，稿件仍保留，可重新製作預覽。" })} /></div>
          </section>}
        </>}
      </div>
    </div>}
  </section>;
}
