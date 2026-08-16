import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

export function WorkflowStatus({ tone = "neutral", children, busy = false }) {
  const Icon = busy ? LoaderCircle : tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className={`studio-status studio-status--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon aria-hidden="true" className={busy ? "studio-spin" : ""} />
      <span>{children}</span>
    </div>
  );
}
