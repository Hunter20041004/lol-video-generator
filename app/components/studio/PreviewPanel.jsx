import { CheckCircle2, Film, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canPublishPreview, failedPublishJobs } from "./studioModel";

function platformLabel(value) {
  return String(value || "").toLowerCase() === "threads" ? "Threads" : "Instagram";
}

export function PreviewPanel({
  preview,
  publishResult,
  publishing,
  onPublish,
  onRetry,
  disabled,
}) {
  const video = preview?.videos?.[0];
  const failedJobs = failedPublishJobs(publishResult);

  return (
    <section className="studio-preview" aria-label="影片預覽">
      <div className="studio-section-heading">
        <span>PREVIEW</span>
        <h2>成品確認</h2>
      </div>

      {video ? (
        <div className="studio-video-frame">
          <video key={video.videoUrl} src={video.videoUrl} controls playsInline preload="metadata" />
        </div>
      ) : (
        <div className="studio-preview-empty">
          <Film aria-hidden="true" />
          <strong>預覽會顯示在這裡</strong>
          <span>先從左側選擇內容並產生成品，不會自動發布。</span>
        </div>
      )}

      {video && (
        <div className="studio-preview-footer">
          <div className="studio-validation">
            <CheckCircle2 aria-hidden="true" />
            <span>{canPublishPreview(preview) ? "媒體驗證已通過" : "媒體驗證尚未通過"}</span>
          </div>
          {publishResult?.jobs?.length > 0 && (
            <div className="studio-platform-results" aria-label="發布結果">
              {publishResult.jobs.map((job) => (
                <span key={job.id || `${job.platform}-${job.locale}`} data-status={job.status}>
                  {platformLabel(job.platform)} · {job.status}
                </span>
              ))}
            </div>
          )}
          {failedJobs.length > 0 ? (
            <Button onClick={() => onRetry(failedJobs)} disabled={publishing || disabled}>
              <RotateCcw aria-hidden="true" />
              只重試失敗平台
            </Button>
          ) : (
            <Button
              onClick={onPublish}
              disabled={!canPublishPreview(preview) || publishing || disabled}
            >
              <Send aria-hidden="true" />
              {publishing ? "發布中…" : "確認發布這份成品"}
            </Button>
          )}
          <p>發布會使用畫面上這一份影片，不會重新渲染。</p>
        </div>
      )}
    </section>
  );
}
