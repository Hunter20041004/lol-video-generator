import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { BgmLayer } from "../video-system/BgmLayer";
import { HextechBackground } from "../video-system/HextechBackground";
import { SubtitleCaption } from "../video-system/SubtitleCaption";
import { buildTimeline, getActiveTimelineScene } from "../video-system/pacing";
import { resolveRenderAssetSrc } from "../video-system/renderAssetSrc";
import {
  KineticTitle,
  PipelineChrome,
  SafeStage,
  getPipelineTheme,
} from "../video-system/VideoPrimitives";

const ROLE_LABELS_ZH = {
  Top: "上路",
  Jungle: "打野",
  Mid: "中路",
  ADC: "下路",
  Support: "輔助",
};
const META_TIER_SUBTITLE_BOTTOM = 300;

function isEnglishVideo(data = {}) {
  return String(data.locale || data.outputLanguage || "zh").toLowerCase().startsWith("en");
}

function roleLabel(role = "Mid", locale = "zh") {
  if (String(locale || "zh").toLowerCase().startsWith("en")) return role || "Mid";
  return ROLE_LABELS_ZH[role] || role || "中路";
}

function getTierTemplateCopy(data = {}) {
  const en = isEnglishVideo(data);
  const lane = data.roleLabel || roleLabel(data.role, en ? "en" : "zh");
  return en ? {
    chromeLeft: "META TIER BOARD",
    chromeRight: "COMPOSITE SCORE",
    eyebrow: `${lane} · Top ${data.rankingSize || data.entries?.length || 5}`,
    title: data.title || `${lane} Top ${data.rankingSize || 5}`,
    subtitle: data.downgradeReason || "Composite score: win rate, pick rate, ban pressure and sample size.",
    verdictTitle: "How to read it",
    verdictBody: "Composite score, not pure win rate. Prioritize stability, sample size and ban pressure.",
    scoreLabel: "Score",
  } : {
    chromeLeft: "版本梯度榜",
    chromeRight: "綜合強度分",
    eyebrow: `${lane} · 前 ${data.rankingSize || data.entries?.length || 5}`,
    title: data.title || `${lane} 梯度榜前 ${data.rankingSize || 5}`,
    subtitle: data.downgradeReason || "勝率、登場率、禁用率與樣本一起看。",
    verdictTitle: "榜單讀法",
    verdictBody: "這是綜合強度分，不是單看勝率；優先看穩定度、樣本與禁用壓力。",
    scoreLabel: "分數",
  };
}

const fallbackStoryboard = (data = {}) => {
  if (data.storyboard?.length) return data.storyboard;
  const copy = getTierTemplateCopy(data);
  if (isEnglishVideo(data)) {
    return [
      { tag: "HOOK", text: `${copy.title}\nwatch the top picks`, durationInFrames: 90 },
      { tag: "RANKING", text: "Composite score\nnot pure win rate", durationInFrames: 210 },
      { tag: "CONCLUSION_CTA", text: "Which role next?\nComment below", durationInFrames: 90 },
    ];
  }
  return [
    { tag: "HOOK", text: `${copy.title}\n先看版本答案`, durationInFrames: 90 },
    { tag: "RANKING", text: "綜合強度分\n不是只看勝率", durationInFrames: 210 },
    { tag: "CONCLUSION_CTA", text: "下一路想看哪裡\n留言告訴我", durationInFrames: 90 },
  ];
};

const bandColor = (band = "A", theme) => {
  if (band === "S") return "#f0c674";
  if (band === "A") return theme.accent;
  return theme.secondary;
};

const TierRow = ({ entry = {}, index = 0, theme }) => {
  const championName = entry.localizedChampionName || entry.champion || "英雄";
  const color = bandColor(entry.tierBand, theme);
  const icon = entry.heroIconUrl;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "74px 82px 1fr 130px",
        alignItems: "center",
        gap: 18,
        minHeight: 116,
        padding: "16px 22px",
        borderRadius: 8,
        border: `1.5px solid ${color}88`,
        background: "linear-gradient(90deg, rgba(2,6,14,0.9), rgba(11,27,44,0.68))",
        boxShadow: `0 0 28px ${color}22, inset 0 0 26px rgba(255,255,255,0.035)`,
      }}
    >
      <div style={{ color, fontSize: 32, fontWeight: 950, textAlign: "center" }}>
        #{entry.rank || index + 1}
      </div>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 8,
          overflow: "hidden",
          border: `2px solid ${color}aa`,
          background: "rgba(2,6,14,0.92)",
        }}
      >
        {icon ? (
          <Img src={resolveRenderAssetSrc(icon)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color, fontSize: 30, fontWeight: 950 }}>
            {championName.slice(0, 1)}
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <div style={{ color: "#fff", fontSize: 36, fontWeight: 950, lineHeight: 1.05 }}>{championName}</div>
          <div style={{ color, fontSize: 28, fontWeight: 950 }}>{entry.tierBand || "A"}</div>
        </div>
        <div style={{ color: "rgba(219,234,254,0.78)", fontSize: 20, fontWeight: 850, marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.statLine || (entry.reasons || []).slice(0, 2).join(" · ")}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: theme.secondary, fontSize: 44, fontWeight: 950, lineHeight: 1 }}>{entry.tierScore ?? "-"}</div>
        <div style={{ color: "rgba(240,230,210,0.62)", fontSize: 16, fontWeight: 900, marginTop: 6 }}>{isEnglishVideo(entry) ? "score" : "分數"}</div>
      </div>
    </div>
  );
};

const TierVerdict = ({ tierVerdict, copy, theme }) => {
  const verdict = tierVerdict || { title: copy.verdictTitle, body: copy.verdictBody, chips: [] };
  const body = tierVerdict?.body || verdict.body;
  return (
    <section
      style={{
        padding: "22px 26px",
        borderRadius: 8,
        border: `1.5px solid ${theme.secondary}88`,
        background: "rgba(2,6,14,0.82)",
      }}
    >
      <div style={{ color: theme.secondary, fontSize: 23, fontWeight: 950, letterSpacing: 3 }}>{verdict.title}</div>
      <div style={{ color: "#fff", fontSize: 31, fontWeight: 930, lineHeight: 1.18, marginTop: 10 }}>{body}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        {(verdict.chips || []).slice(0, 3).map((chip) => (
          <span
            key={chip}
            style={{
              color: "#07111f",
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})`,
              borderRadius: 6,
              padding: "7px 12px",
              fontSize: 18,
              fontWeight: 950,
            }}
          >
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
};

export const Template_MetaTierRanking = ({ data = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getPipelineTheme("META_TIER_RANKING");
  const timeline = buildTimeline(fallbackStoryboard(data), fps);
  const active = getActiveTimelineScene(timeline, frame);
  const copy = getTierTemplateCopy(data);
  const entries = (data.entries || []).slice(0, Math.min(data.rankingSize || 5, 5));
  const tierVerdict = data.tierVerdict || { title: copy.verdictTitle, body: copy.verdictBody, chips: [] };

  return (
    <AbsoluteFill style={{ backgroundColor: "#07111f", color: "#fff", fontFamily: "'Outfit', 'Noto Sans TC', sans-serif", overflow: "hidden" }}>
      <HextechBackground tactical />
      <PipelineChrome theme={theme} left={copy.chromeLeft} right={copy.chromeRight} />
      <BgmLayer bgmFile={data.bgmFile === undefined ? "audio/bgm2.mp3" : data.bgmFile} />
      <SafeStage inset="94px 62px 150px">
        <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 20 }}>
          <KineticTitle
            eyebrow={copy.eyebrow}
            title={copy.title}
            subtitle={copy.subtitle}
            theme={theme}
            localFrame={active.localFrame}
            size={62}
          />
          <section style={{ display: "grid", gridTemplateRows: `repeat(${entries.length || 1}, 1fr)`, gap: 12 }}>
            {entries.map((entry, index) => (
              <TierRow key={`${entry.rank || index}-${entry.champion}`} entry={entry} index={index} theme={theme} />
            ))}
          </section>
          <TierVerdict tierVerdict={tierVerdict} copy={copy} theme={theme} />
        </div>
      </SafeStage>
      <SubtitleCaption scene={active.scene} activeStart={active.start} accent={theme.accent} bottom={META_TIER_SUBTITLE_BOTTOM} variant="lowerThird" />
    </AbsoluteFill>
  );
};
