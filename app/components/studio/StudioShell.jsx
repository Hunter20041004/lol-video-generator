"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EsportsWorkflow } from "./EsportsWorkflow";

function WorkflowPlaceholder({ title, description, testId, hidden }) {
  return (
    <section
      data-testid={testId}
      hidden={hidden}
      aria-hidden={hidden}
      className="studio-placeholder"
    >
      <div>
        <span className="studio-eyebrow">DAILY WORKFLOW</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="studio-placeholder-grid" aria-hidden="true">
        <div />
        <div />
      </div>
    </section>
  );
}

export function StudioShell({ portfolioReadOnly, portfolioDemoState }) {
  const [activeWorkflow, setActiveWorkflow] = useState("esports");

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="studio-brand" aria-label="Hextech Video Studio">
          <span className="studio-brand-mark">HVS</span>
          <span>HEXTECH VIDEO STUDIO</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className="studio-advanced-trigger">
              <Settings2 aria-hidden="true" />
              進階工具
            </Button>
          </SheetTrigger>
          <SheetContent className="studio-advanced-sheet">
            <SheetHeader>
              <SheetTitle>進階工具</SheetTitle>
              <SheetDescription>
                Meta、洞察、發布佇列與工程資訊會保留在這裡，不干擾日常產片。
              </SheetDescription>
            </SheetHeader>
            <div className="studio-advanced-placeholder">
              {portfolioReadOnly ? "作品集唯讀模式" : "工具將在後續切片接回既有功能"}
              {portfolioDemoState ? " · Demo data ready" : ""}
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <Tabs value={activeWorkflow} onValueChange={setActiveWorkflow} className="studio-tabs">
        <TabsList aria-label="影片工作流程">
          <TabsTrigger value="esports">賽事影片</TabsTrigger>
          <TabsTrigger value="version">版本更新</TabsTrigger>
        </TabsList>
      </Tabs>

      <EsportsWorkflow
        portfolioReadOnly={portfolioReadOnly}
        hidden={activeWorkflow !== "esports"}
      />
      <WorkflowPlaceholder
        title="版本更新"
        description="手動選擇一則版本內容，先看過成品，再確認是否發布。"
        testId="version-workflow"
        hidden={activeWorkflow !== "version"}
      />
    </main>
  );
}
