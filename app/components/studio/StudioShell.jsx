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
import { VersionWorkflow } from "./VersionWorkflow";

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
      <VersionWorkflow
        portfolioReadOnly={portfolioReadOnly}
        hidden={activeWorkflow !== "version"}
      />
    </main>
  );
}
