import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { HEXTECH_COLORS, glassPanel } from "./HextechBackground";

export const PIPELINE_THEMES = {
  PATCH: { label: "PATCH TRACKER", accent: HEXTECH_COLORS.gold, secondary: HEXTECH_COLORS.cyan },
  SYSTEM_UPDATE: { label: "SYSTEM META DESK", accent: HEXTECH_COLORS.cyan, secondary: HEXTECH_COLORS.gold },
  PLAYER_RADAR: { label: "PLAYER RADAR", accent: HEXTECH_COLORS.cyan, secondary: "#8855FF" },
  ESPORTS_H2H_RADAR: { label: "H2H RADAR", accent: HEXTECH_COLORS.cyan, secondary: HEXTECH_COLORS.gold },
  ESPORTS_MATCH_RECAP: { label: "MATCH RECAP", accent: "#34d399", secondary: HEXTECH_COLORS.gold },
  ITEM_UPDATE: { label: "ITEM/RUNE TRACKER", accent: HEXTECH_COLORS.gold, secondary: HEXTECH_COLORS.cyan },
  RUNE_UPDATE: { label: "ITEM/RUNE TRACKER", accent: HEXTECH_COLORS.gold, secondary: HEXTECH_COLORS.cyan },
  META_OFFMETA_PICK: { label: "BLACK TECH CHECK", accent: "#34d399", secondary: HEXTECH_COLORS.gold },
  META_TIER_RANKING: { label: "META TIER BOARD", accent: HEXTECH_COLORS.cyan, secondary: "#8855FF" },
};

export const getPipelineTheme = (dataType = "PATCH") => PIPELINE_THEMES[dataType] || PIPELINE_THEMES.PATCH;

export const SafeStage = ({ children, inset = "82px 72px 230px", style = {} }) => (
  <div style={{ position: "absolute", inset, zIndex: 5, ...style }}>{children}</div>
);

export const PipelineChrome = ({ theme, left = "HEXTECH VIDEO STUDIO", right = "SHORTS ENGINE" }) => (
  <>
    <div
      style={{
        position: "absolute",
        inset: 46,
        zIndex: 4,
        pointerEvents: "none",
        border: `3px solid ${theme?.accent || HEXTECH_COLORS.gold}99`,
        boxShadow: `0 0 42px ${(theme?.secondary || HEXTECH_COLORS.cyan)}33, inset 0 0 55px rgba(3,10,20,0.82)`,
        clipPath: "polygon(28px 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%, 0 28px)",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 58,
        left: 78,
        right: 78,
        zIndex: 6,
        display: "flex",
        justifyContent: "space-between",
        color: "rgba(240,230,210,0.5)",
        fontSize: 18,
        fontWeight: 900,
        letterSpacing: 4,
      }}
    >
      <span>{left}</span>
      <span>{right}</span>
    </div>
  </>
);

export const PipelineBadge = ({ children, theme, localFrame = 0 }) => {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: Math.max(0, localFrame), fps, config: { stiffness: 190, damping: 15, mass: 0.65 } });
  const accent = theme?.accent || HEXTECH_COLORS.gold;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "13px 28px",
        border: `2px solid ${accent}`,
        borderRadius: 999,
        background: "rgba(2,6,14,0.68)",
        color: accent,
        fontSize: 22,
        fontWeight: 950,
        letterSpacing: 4,
        boxShadow: `0 0 28px ${accent}66, inset 0 0 20px rgba(255,255,255,0.06)`,
        transform: `translateY(${interpolate(pop, [0, 1], [-24, 0])}px) scale(${interpolate(pop, [0, 1], [0.86, 1])})`,
        opacity: pop,
      }}
    >
      {children}
    </div>
  );
};

export const KineticTitle = ({ eyebrow, title, subtitle, theme, localFrame = 0, size = 88 }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const titleIn = spring({ frame: Math.max(0, localFrame - 8), fps, config: { stiffness: 120, damping: 15 } });
  const accent = theme?.accent || HEXTECH_COLORS.gold;
  const scan = interpolate((frame + 30) % 90, [0, 90], [-420, 420]);

  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      {eyebrow ? (
        <div style={{ color: accent, fontSize: 24, fontWeight: 950, letterSpacing: 7, marginBottom: 16 }}>
          {eyebrow}
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          display: "inline-block",
          overflow: "hidden",
          maxWidth: 900,
          color: "#fff",
          fontSize: size,
          fontWeight: 950,
          lineHeight: 1.03,
          textWrap: "balance",
          wordBreak: "keep-all",
          textShadow: `0 0 48px ${accent}55, 0 8px 30px rgba(0,0,0,0.95)`,
          transform: `translateY(${interpolate(titleIn, [0, 1], [48, 0])}px) scale(${interpolate(titleIn, [0, 1], [0.92, 1])})`,
          opacity: titleIn,
        }}
      >
        {title}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 130,
            left: "50%",
            background: `linear-gradient(90deg, transparent, ${accent}55, transparent)`,
            transform: `translateX(${scan}px) skewX(-14deg)`,
            mixBlendMode: "screen",
          }}
        />
      </div>
      {subtitle ? (
        <div style={{ marginTop: 18, color: theme?.secondary || HEXTECH_COLORS.cyan, fontSize: 34, fontWeight: 900, lineHeight: 1.22 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};

export const GlassPanel = ({ children, accent = HEXTECH_COLORS.cyan, style = {} }) => (
  <div
    style={{
      ...glassPanel(accent),
      border: `2px solid ${accent}66`,
      borderRadius: 24,
      padding: 28,
      ...style,
    }}
  >
    {children}
  </div>
);

export const DataPill = ({ label, value, color = HEXTECH_COLORS.gold }) => (
  <div
    style={{
      minWidth: 135,
      padding: "12px 16px",
      borderRadius: 18,
      border: `1px solid ${color}66`,
      background: "rgba(2,6,14,0.58)",
      textAlign: "center",
      boxShadow: `0 0 18px ${color}22`,
    }}
  >
    <div style={{ color: "rgba(240,230,210,0.62)", fontSize: 17, fontWeight: 900, letterSpacing: 2 }}>{label}</div>
    <div style={{ color, fontSize: 34, fontWeight: 950, lineHeight: 1.05, marginTop: 4 }}>{value}</div>
  </div>
);

export const RevealList = ({ items = [], localFrame = 0, accent = HEXTECH_COLORS.cyan, renderItem }) => {
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      {items.map((item, index) => {
        const pop = spring({ frame: Math.max(0, localFrame - index * 8), fps, config: { stiffness: 180, damping: 16 } });
        return (
          <div
            key={index}
            style={{
              transform: `translateX(${interpolate(pop, [0, 1], [index % 2 ? 72 : -72, 0])}px)`,
              opacity: pop,
            }}
          >
            {renderItem ? renderItem(item, index) : <GlassPanel accent={accent}>{String(item)}</GlassPanel>}
          </div>
        );
      })}
    </div>
  );
};

export const VerdictCard = ({
  title,
  body,
  chips = [],
  theme,
  localFrame = 0,
  width = "88%",
  titleSize = 28,
  bodySize = 48,
  chipFontSize = 21,
  panelStyle = {},
}) => {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: Math.max(0, localFrame), fps, config: { stiffness: 155, damping: 16 } });
  const accent = theme?.accent || HEXTECH_COLORS.gold;

  return (
    <GlassPanel
      accent={accent}
      style={{
        width,
        textAlign: "center",
        transform: `translateY(${interpolate(pop, [0, 1], [46, 0])}px) scale(${interpolate(pop, [0, 1], [0.94, 1])})`,
        opacity: pop,
        ...panelStyle,
      }}
    >
      <div style={{ color: accent, fontSize: titleSize, fontWeight: 950, letterSpacing: 5 }}>{title}</div>
      <div style={{ color: "#fff", fontSize: bodySize, fontWeight: 950, lineHeight: 1.18, marginTop: 18, textWrap: "balance" }}>{body}</div>
      {chips.length > 0 ? (
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {chips.map((chip) => (
            <span
              key={chip}
              style={{
                color: "#07111f",
                background: `linear-gradient(90deg, ${accent}, #f4d58d)`,
                borderRadius: 999,
                padding: "8px 15px",
                fontSize: chipFontSize,
                fontWeight: 950,
                whiteSpace: "nowrap",
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </GlassPanel>
  );
};

export const ActionableVerdictPanel = ({ verdict, theme, localFrame = 0, compact = false }) => {
  const safeVerdict = verdict || {};
  const title = safeVerdict.title || safeVerdict.recommendation || safeVerdict.pickAdvice || "實戰結論";
  const body = safeVerdict.body || safeVerdict.reason || safeVerdict.summary || safeVerdict.oneLineVerdict || "先用一般對局測試強度，再決定是否投入排位。";
  const chips = Array.isArray(safeVerdict.chips)
    ? safeVerdict.chips
    : [
        safeVerdict.timing,
        safeVerdict.riskLevel,
        safeVerdict.targetAudience,
        ...(Array.isArray(safeVerdict.bestFor) ? safeVerdict.bestFor : []),
        ...(Array.isArray(safeVerdict.avoidWhen) ? safeVerdict.avoidWhen.map((x) => `避開：${x}`) : []),
      ].filter(Boolean);

  return (
    <VerdictCard
      title={title}
      body={body}
      chips={chips.slice(0, compact ? 2 : 4)}
      theme={theme}
      localFrame={localFrame}
    />
  );
};
