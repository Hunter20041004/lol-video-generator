import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BgmLayer } from "../video-system/BgmLayer";
import { HextechBackground, HEXTECH_COLORS } from "../video-system/HextechBackground";
import { SubtitleCaption } from "../video-system/SubtitleCaption";
import { buildTimeline, getActiveTimelineScene } from "../video-system/pacing";
import {
  PipelineBadge,
  PipelineChrome,
  SafeStage,
  getPipelineTheme,
} from "../video-system/VideoPrimitives";
import playerRadarHelpers from "./playerRadarHelpers";

const {
  buildConclusionVerdict,
  deriveMatchupDisplayPlayers,
  getHookProofPillValue,
  getMatchupMetricDisplay,
  getOpeningEvidence,
  getPlayer,
  getPlayerRadarCopy,
  getRoleLabel,
  isEnglishLocale,
  samePlayer,
} = playerRadarHelpers;

const PLAYER_RADAR_STAGE_INSET = "80px 56px 300px";
const PLAYER_RADAR_SUBTITLE_BOTTOM = 235;
const BROADCAST_CLIP = "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)";
const PANEL_SURFACE = "linear-gradient(135deg, rgba(4,11,24,0.93), rgba(7,21,35,0.86) 48%, rgba(2,7,16,0.95))";

const getProofBadgeLabel = (proofType, data = {}) => {
  const copy = getPlayerRadarCopy(data);
  return proofType === "mvp" ? copy.hookProofTypeLabels.mvp : copy.hookProofTypeLabels.key_player;
};

const buildRadarStoryboard = (data = {}) => {
  if (Array.isArray(data.storyboard) && data.storyboard.length > 0) return data.storyboard;
  const copy = getPlayerRadarCopy(data);
  const playerName = data.player?.name || data.proofSegment?.player?.name || "";
  return copy.storyboard.map((scene) => ({
    ...scene,
    text: scene.text.replace("(playerName)", playerName),
  }));
};

const normalizeStats = (data = {}) => {
  return (Array.isArray(data.radarStats) ? data.radarStats : []).slice(0, 5);
};

const shouldShowRadarChart = (radarStats = []) => radarStats.length >= 4;

const formatNumber = (value, digits = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value ?? "");
  if (Number.isInteger(parsed) && digits === 0) return String(parsed);
  return parsed.toFixed(digits);
};

const formatMetricValue = (metric = "", value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value ?? "");
  if (metric === "KP%") return `${Math.round(parsed * 100)}%`;
  if (metric === "DPM" || metric === "GPM") return String(Math.round(parsed));
  if (metric === "KDA") return formatNumber(parsed, 1);
  return Number.isInteger(parsed) ? String(parsed) : String(Math.round(parsed * 10) / 10);
};

const formatMetricDelta = (metric = "", value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  if (metric === "KP%") return `+${Math.round(parsed * 100)}pp`;
  if (metric === "DPM" || metric === "GPM") return `+${Math.round(parsed)}`;
  if (metric === "KDA") return `+${formatNumber(parsed, 1)}`;
  return `+${Number.isInteger(parsed) ? parsed : Math.round(parsed * 10) / 10}`;
};

const getScoreText = (match = {}) => {
  const score = String(match.seriesScore || "").trim();
  return score || "";
};

const getTeamLine = (match = {}) => [match.teamA, match.teamB].filter(Boolean).join(" vs ");

const joinMetrics = (metrics = [], data = {}) => {
  const fallback = isEnglishLocale(data) ? "KDA, CSM, DPM" : "KDA、CSM、DPM";
  const clean = metrics.filter(Boolean).slice(0, 3);
  if (clean.length === 0) return fallback;
  return isEnglishLocale(data) ? clean.join(", ") : clean.join("、");
};

const getTemplateCopy = (data = {}) => {
  const en = isEnglishLocale(data);
  return en
    ? {
      creatorRead: "CREATOR READ",
      primaryGap: "LANE VERDICT",
      focus: "FOCUS",
      opponent: "OPPONENT",
      sourceRead: "SOURCE READ",
      proofCase: "MVP CASE",
      matchupEvidence: (name) => `${name} created a lane gap the stats can show.`,
      proofWhyTitle: "WHY IT HOLDS",
      proofWhyBody: (metrics) => `The case is built on ${joinMetrics(metrics, data)}, all source-backed.`,
      sourceValue: "source value",
      conclusionTitleSame: "ONE PLAYER, TWO CASES",
      conclusionTitleSplit: "GAP AND MVP SPLIT",
    }
    : {
      creatorRead: "賽後判讀",
      primaryGap: "這路差距",
      focus: "觀察點",
      opponent: "對手",
      sourceRead: "來源證據",
      proofCase: "MVP 證明",
      matchupEvidence: (name) => `${name} 的領先不是一句打得好，數字直接指向這路。`,
      proofWhyTitle: "為什麼成立",
      proofWhyBody: (metrics) => `三項核心數據就夠說服：${joinMetrics(metrics, data)} 都站得住。`,
      sourceValue: "來源值",
      conclusionTitleSame: "同一人雙重證明",
      conclusionTitleSplit: "對位差與 MVP 分開看",
    };
};

const TeamMark = ({ label, side = "left", accent }) => {
  if (!label) return null;
  const isLeft = side === "left";
  return (
    <div
      style={{
        position: "absolute",
        top: isLeft ? 124 : 276,
        [isLeft ? "left" : "right"]: 42,
        width: 228,
        padding: "18px 20px",
        color: "#fff",
        fontSize: 36,
        fontWeight: 950,
        letterSpacing: 4,
        lineHeight: 1,
        textAlign: isLeft ? "left" : "right",
        border: `1px solid ${accent}4d`,
        background: `linear-gradient(${isLeft ? 104 : 284}deg, ${accent}24, rgba(3,8,18,0.28) 72%)`,
        clipPath: BROADCAST_CLIP,
        opacity: 0.08,
      }}
    >
      {label}
    </div>
  );
};

const PlayerRadarBroadcastBackdrop = ({ data, theme, localFrame = 0, emphasis = "player" }) => {
  const match = data.matchContext || {};
  const teamA = String(match.teamA || "");
  const teamB = String(match.teamB || "");
  const beam = interpolate((localFrame + 15) % 110, [0, 55, 110], [0.42, 0.72, 0.42]);

  return (
    <div style={{ position: "absolute", inset: -64, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: [
            `radial-gradient(circle at 20% 16%, ${theme.accent}24, transparent 35%)`,
            `radial-gradient(circle at 82% 24%, ${theme.secondary}24, transparent 36%)`,
            "linear-gradient(112deg, rgba(3,18,31,0.94) 0%, rgba(3,8,18,0.98) 49%, rgba(22,7,23,0.9) 100%)",
          ].join(", "),
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "74px 54px auto",
          height: 520,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.85), transparent)",
          opacity: 0.34,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -110,
          top: 150,
          width: 610,
          height: 1040,
          transform: "skewX(-16deg)",
          background: `linear-gradient(180deg, ${theme.accent}14, transparent 72%)`,
          borderRight: `1px solid ${theme.accent}2f`,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -110,
          top: 224,
          width: 610,
          height: 1040,
          transform: "skewX(16deg)",
          background: `linear-gradient(180deg, ${theme.secondary}18, transparent 72%)`,
          borderLeft: `1px solid ${theme.secondary}2f`,
        }}
      />
      <TeamMark label={teamA} side="left" accent={theme.accent} />
      <TeamMark label={teamB} side="right" accent={theme.secondary} />
      <div
        style={{
          position: "absolute",
          left: "10%",
          right: "10%",
          top: "38%",
          height: 4,
          background: `linear-gradient(90deg, transparent, ${theme.accent}99, ${HEXTECH_COLORS.gold}, ${theme.secondary}99, transparent)`,
          boxShadow: `0 0 38px rgba(200,170,110,${beam})`,
          transform: "rotate(-5deg)",
          opacity: beam,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "100% 7px",
          opacity: 0.1,
        }}
      />
    </div>
  );
};

const PlayerRadarHeroBackdrop = PlayerRadarBroadcastBackdrop;

const BroadcastPanel = ({ children, accent = HEXTECH_COLORS.gold, style = {}, innerStyle = {} }) => (
  <div
    style={{
      position: "relative",
      clipPath: "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)",
      border: `1px solid ${accent}66`,
      background: PANEL_SURFACE,
      boxShadow: `0 26px 68px rgba(0,0,0,0.42), inset 0 0 32px ${accent}12`,
      overflow: "hidden",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: "0 0 auto",
        height: 3,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        opacity: 0.9,
      }}
    />
    <div
      style={{
        position: "absolute",
        right: -80,
        top: -70,
        width: 220,
        height: 220,
        background: `radial-gradient(circle, ${accent}24, transparent 68%)`,
      }}
    />
    <div style={{ position: "relative", zIndex: 1, ...innerStyle }}>{children}</div>
  </div>
);

const MinimalScoreBug = ({ data, theme }) => {
  const match = data.matchContext || {};
  const teamLine = getTeamLine(match);
  const score = getScoreText(match);
  const league = String(match.league || "").trim();

  return (
    <BroadcastPanel
      accent={theme.accent}
      style={{
        zIndex: 1,
        justifySelf: "center",
        width: "100%",
        background: "linear-gradient(135deg, rgba(3,8,18,0.78), rgba(4,16,29,0.7))",
        boxShadow: `0 18px 44px rgba(0,0,0,0.32), inset 0 0 20px ${theme.accent}0f`,
      }}
      innerStyle={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: 14,
        padding: "11px 16px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "rgba(240,230,210,0.62)", fontSize: 15, fontWeight: 950, letterSpacing: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {league}
        </div>
        <div style={{ marginTop: 4, color: "#fff", fontSize: 20, fontWeight: 950, letterSpacing: 1.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {teamLine}
        </div>
      </div>
      <div style={{ color: HEXTECH_COLORS.gold, fontSize: 28, fontWeight: 950, lineHeight: 1, textAlign: "right" }}>
        {score}
      </div>
    </BroadcastPanel>
  );
};

const ScorelineStrip = (props) => <MinimalScoreBug {...props} />;

const getMeterShare = (reason = {}, segment = {}) => {
  const values = getMatchupMetricDisplay(reason, segment);
  const left = Number(values.leftValue);
  const right = Number(values.rightValue);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left + right <= 0) {
    return samePlayer(segment.focusPlayer, segment.edgePlayer) ? 0.66 : 0.34;
  }
  return Math.min(0.78, Math.max(0.22, left / (left + right)));
};

const PlayerPlate = ({ label, player = {}, accent, align = "left", data = {} }) => (
  <div
    style={{
      minHeight: 154,
      padding: "24px 22px",
      border: `1px solid ${accent}55`,
      background: `linear-gradient(${align === "left" ? 112 : 248}deg, ${accent}18, rgba(3,8,18,0.66))`,
      clipPath: BROADCAST_CLIP,
      display: "grid",
      alignContent: "space-between",
      textAlign: align,
    }}
  >
    <div style={{ color: accent, fontSize: 17, fontWeight: 950, letterSpacing: 4 }}>{label}</div>
    <div>
      <div style={{ color: "#fff", fontSize: 45, fontWeight: 950, lineHeight: 0.96 }}>
        {player.name}
      </div>
      <div style={{ marginTop: 10, color: "rgba(219,234,254,0.78)", fontSize: 23, fontWeight: 850 }}>
        {[player.team, getRoleLabel(player.role, data)].filter(Boolean).join(" · ")}
      </div>
    </div>
  </div>
);

const SplitMatchupMeter = ({ reason, segment, theme, data = {}, compact = false }) => {
  if (!reason) return null;
  const templateCopy = getTemplateCopy(data);
  const displayPlayers = deriveMatchupDisplayPlayers(segment);
  const focusPlayer = displayPlayers.focusPlayer;
  const opponentPlayer = displayPlayers.opponentPlayer;
  const values = getMatchupMetricDisplay(reason, segment);
  const metric = reason.metric || "";
  const leftValue = formatMetricValue(metric, values.leftValue);
  const rightValue = formatMetricValue(metric, values.rightValue);
  const leftShare = getMeterShare(reason, segment);
  const leftOwnsEdge = samePlayer(focusPlayer, displayPlayers.edgePlayer);
  const rightOwnsEdge = samePlayer(opponentPlayer, displayPlayers.edgePlayer);

  return (
    <BroadcastPanel
      accent={HEXTECH_COLORS.gold}
      innerStyle={{ padding: compact ? 22 : 26, display: "grid", gap: compact ? 18 : 22 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 92px 1fr", gap: 18, alignItems: "stretch" }}>
        <PlayerPlate
          label={leftOwnsEdge ? templateCopy.primaryGap : templateCopy.focus}
          player={focusPlayer}
          accent={leftOwnsEdge ? HEXTECH_COLORS.gold : theme.accent}
          data={data}
        />
        <div style={{ display: "grid", placeItems: "center", color: HEXTECH_COLORS.gold, fontSize: 32, fontWeight: 950 }}>
          VS
        </div>
        <PlayerPlate
          label={rightOwnsEdge ? templateCopy.primaryGap : templateCopy.opponent}
          player={opponentPlayer}
          accent={rightOwnsEdge ? HEXTECH_COLORS.gold : theme.secondary}
          align="right"
          data={data}
        />
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", gap: 18 }}>
          <div style={{ color: "#fff", fontSize: compact ? 38 : 48, fontWeight: 950, lineHeight: 1 }}>{leftValue}</div>
          <div style={{ color: HEXTECH_COLORS.gold, fontSize: compact ? 36 : 50, fontWeight: 950, lineHeight: 1 }}>
            {metric} {formatMetricDelta(metric, reason.delta)}
          </div>
          <div style={{ color: "#fff", fontSize: compact ? 38 : 48, fontWeight: 950, lineHeight: 1, textAlign: "right" }}>{rightValue}</div>
        </div>
        <div style={{ marginTop: 14, height: 18, display: "grid", gridTemplateColumns: `${leftShare}fr ${1 - leftShare}fr`, gap: 4 }}>
          <div style={{ background: `linear-gradient(90deg, ${leftOwnsEdge ? HEXTECH_COLORS.gold : theme.accent}, rgba(255,255,255,0.18))`, boxShadow: leftOwnsEdge ? `0 0 22px ${HEXTECH_COLORS.gold}55` : "none" }} />
          <div style={{ background: `linear-gradient(90deg, rgba(255,255,255,0.18), ${rightOwnsEdge ? HEXTECH_COLORS.gold : theme.secondary})`, boxShadow: rightOwnsEdge ? `0 0 22px ${HEXTECH_COLORS.gold}55` : "none" }} />
        </div>
      </div>
    </BroadcastPanel>
  );
};

const MatchupStatSpotlight = ({ reason, segment, theme, data = {}, compact = false }) => (
  <SplitMatchupMeter reason={reason} segment={segment} theme={theme} data={data} compact={compact} />
);

const VerdictStatRail = ({ reasons = [], segment, theme, max = 3 }) => {
  const visible = reasons.filter(Boolean).slice(0, max);
  if (visible.length === 0) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${visible.length}, 1fr)`, gap: 12 }}>
      {visible.map((reason) => {
        const values = getMatchupMetricDisplay(reason, segment);
        return (
          <div
            key={reason.metric}
            style={{
              padding: "16px 18px",
              border: `1px solid ${theme.accent}33`,
              background: "rgba(3,8,18,0.58)",
              clipPath: BROADCAST_CLIP,
            }}
          >
            <div style={{ color: theme.accent, fontSize: 18, fontWeight: 950, letterSpacing: 3 }}>{reason.metric}</div>
            <div style={{ marginTop: 8, color: "#fff", fontSize: 27, fontWeight: 950, lineHeight: 1 }}>
              {formatMetricValue(reason.metric, values.leftValue)} / {formatMetricValue(reason.metric, values.rightValue)}
            </div>
            <div style={{ marginTop: 6, color: HEXTECH_COLORS.gold, fontSize: 26, fontWeight: 950 }}>
              {formatMetricDelta(reason.metric, reason.delta)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CompactEvidenceCard = ({ reason, index, theme, data = {}, large = false }) => {
  const metric = reason.metric || "";
  const rawValue = formatMetricValue(metric, reason.rawValue);
  const score = Number(reason.score);
  const scoreText = Number.isFinite(score) ? Math.round(score) : reason.score;
  const templateCopy = getTemplateCopy(data);

  return (
    <BroadcastPanel
      accent={index === 0 ? HEXTECH_COLORS.gold : theme.accent}
      innerStyle={{
        padding: large ? "27px 28px" : "22px 24px",
        display: "grid",
        gridTemplateColumns: large ? "64px 1fr auto" : "52px 1fr auto",
        alignItems: "center",
        gap: 18,
      }}
      style={{
        background: index === 0
          ? "linear-gradient(135deg, rgba(36,26,8,0.93), rgba(5,13,25,0.9))"
          : PANEL_SURFACE,
      }}
    >
      <div style={{ color: HEXTECH_COLORS.gold, fontSize: large ? 45 : 36, fontWeight: 950, lineHeight: 1 }}>
        0{index + 1}
      </div>
      <div>
        <div style={{ color: "#fff", fontSize: large ? 42 : 34, fontWeight: 950, lineHeight: 1 }}>
          {metric}
        </div>
        <div style={{ marginTop: 8, color: "rgba(219,234,254,0.76)", fontSize: large ? 24 : 20, fontWeight: 850 }}>
          {templateCopy.sourceValue} {rawValue}
        </div>
      </div>
      <div style={{ color: theme.accent, fontSize: large ? 52 : 42, fontWeight: 950, textAlign: "right" }}>
        {scoreText}
      </div>
    </BroadcastPanel>
  );
};

const EvidenceCard = ({ reason, index, theme, data = {}, large = false }) => (
  <CompactEvidenceCard reason={reason} index={index} theme={theme} data={data} large={large} />
);

const MobileShortStage = ({ children, offset = 0 }) => (
  <div
    style={{
      height: "100%",
      display: "grid",
      alignContent: "center",
      padding: "22px 2px 168px",
      transform: `translateY(${offset}px)`,
    }}
  >
    {children}
  </div>
);

const OnePointSceneBody = ({ children, gap = 22, style = {} }) => (
  <div
    style={{
      width: "100%",
      display: "grid",
      gap,
      ...style,
    }}
  >
    {children}
  </div>
);

const HeroNumber = ({ kicker, value, label, accent = HEXTECH_COLORS.gold, theme }) => (
  <BroadcastPanel
    accent={accent}
    style={{
      background: "linear-gradient(135deg, rgba(38,26,6,0.88), rgba(4,14,28,0.9) 54%, rgba(2,7,16,0.95))",
      boxShadow: `0 30px 84px rgba(0,0,0,0.46), inset 0 0 42px ${accent}18`,
    }}
    innerStyle={{
      padding: "30px 22px 28px",
      textAlign: "center",
    }}
  >
    <div style={{ color: theme?.secondary || "rgba(219,234,254,0.72)", fontSize: 20, fontWeight: 950, letterSpacing: 5, textTransform: "uppercase" }}>
      {kicker}
    </div>
    <div style={{ marginTop: 6, color: "#fff", fontSize: 124, fontWeight: 950, letterSpacing: -2, lineHeight: 0.88, textShadow: `0 0 56px ${accent}66` }}>
      {value}
    </div>
    <div style={{ marginTop: 18, color: accent, fontSize: 30, fontWeight: 950, lineHeight: 1.08, textWrap: "balance" }}>
      {label}
    </div>
  </BroadcastPanel>
);

const ShortMetricBar = ({ reason, segment, theme, data = {} }) => {
  if (!reason) return null;
  const displayPlayers = deriveMatchupDisplayPlayers(segment);
  const focusPlayer = displayPlayers.focusPlayer;
  const opponentPlayer = displayPlayers.opponentPlayer;
  const values = getMatchupMetricDisplay(reason, segment);
  const metric = reason.metric || "";
  const leftValue = formatMetricValue(metric, values.leftValue);
  const rightValue = formatMetricValue(metric, values.rightValue);
  const leftShare = getMeterShare(reason, segment);
  const leftOwnsEdge = samePlayer(focusPlayer, displayPlayers.edgePlayer);
  const rightOwnsEdge = samePlayer(opponentPlayer, displayPlayers.edgePlayer);

  return (
    <BroadcastPanel
      accent={HEXTECH_COLORS.gold}
      innerStyle={{ padding: "18px 20px", display: "grid", gap: 14 }}
      style={{ background: "linear-gradient(135deg, rgba(4,12,24,0.88), rgba(3,8,18,0.92))" }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "end" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: leftOwnsEdge ? HEXTECH_COLORS.gold : theme.accent, fontSize: 16, fontWeight: 950, letterSpacing: 3 }}>
            {focusPlayer.team || getTemplateCopy(data).focus}
          </div>
          <div style={{ marginTop: 5, color: "#fff", fontSize: 29, fontWeight: 950, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {focusPlayer.name}
          </div>
          <div style={{ marginTop: 7, color: "#fff", fontSize: 35, fontWeight: 950, lineHeight: 1 }}>
            {leftValue}
          </div>
        </div>
        <div style={{ color: HEXTECH_COLORS.gold, fontSize: 24, fontWeight: 950, lineHeight: 1, textAlign: "center", minWidth: 84 }}>
          {metric}
          <div style={{ marginTop: 7, color: "rgba(240,230,210,0.7)", fontSize: 18, letterSpacing: 2 }}>VS</div>
        </div>
        <div style={{ minWidth: 0, textAlign: "right" }}>
          <div style={{ color: rightOwnsEdge ? HEXTECH_COLORS.gold : theme.secondary, fontSize: 16, fontWeight: 950, letterSpacing: 3 }}>
            {opponentPlayer.team || getTemplateCopy(data).opponent}
          </div>
          <div style={{ marginTop: 5, color: "#fff", fontSize: 29, fontWeight: 950, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {opponentPlayer.name}
          </div>
          <div style={{ marginTop: 7, color: "#fff", fontSize: 35, fontWeight: 950, lineHeight: 1 }}>
            {rightValue}
          </div>
        </div>
      </div>
      <div style={{ height: 16, display: "grid", gridTemplateColumns: `${leftShare}fr ${1 - leftShare}fr`, gap: 4 }}>
        <div style={{ background: `linear-gradient(90deg, ${leftOwnsEdge ? HEXTECH_COLORS.gold : theme.accent}, rgba(255,255,255,0.18))`, boxShadow: leftOwnsEdge ? `0 0 22px ${HEXTECH_COLORS.gold}55` : "none" }} />
        <div style={{ background: `linear-gradient(90deg, rgba(255,255,255,0.18), ${rightOwnsEdge ? HEXTECH_COLORS.gold : theme.secondary})`, boxShadow: rightOwnsEdge ? `0 0 22px ${HEXTECH_COLORS.gold}55` : "none" }} />
      </div>
    </BroadcastPanel>
  );
};

const MobileStatChips = ({ reasons = [], segment, theme, max = 2 }) => {
  const visible = reasons.filter(Boolean).slice(0, max);
  if (visible.length === 0) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${visible.length}, 1fr)`, gap: 12 }}>
      {visible.map((reason) => {
        const values = getMatchupMetricDisplay(reason, segment);
        return (
          <div
            key={reason.metric}
            style={{
              padding: "14px 16px",
              border: `1px solid ${theme.accent}35`,
              background: "rgba(3,8,18,0.58)",
              clipPath: BROADCAST_CLIP,
            }}
          >
            <div style={{ color: theme.accent, fontSize: 17, fontWeight: 950, letterSpacing: 3 }}>{reason.metric}</div>
            <div style={{ marginTop: 8, color: "#fff", fontSize: 26, fontWeight: 950, lineHeight: 1 }}>
              {formatMetricDelta(reason.metric, reason.delta)}
            </div>
            <div style={{ marginTop: 6, color: "rgba(219,234,254,0.72)", fontSize: 17, fontWeight: 850 }}>
              {formatMetricValue(reason.metric, values.leftValue)} / {formatMetricValue(reason.metric, values.rightValue)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const VerticalEvidenceStack = ({ proofReasons = [], theme, data = {} }) => {
  if (proofReasons.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 13 }}>
      {proofReasons.map((reason, index) => (
        <EvidenceCard
          key={reason.metric || index}
          reason={reason}
          index={index}
          theme={theme}
          data={data}
          large={index === 0}
        />
      ))}
    </div>
  );
};

const SceneShell = ({ data, theme, localFrame, emphasis, children }) => (
  <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 24, overflow: "hidden" }}>
    <PlayerRadarBroadcastBackdrop data={data} theme={theme} localFrame={localFrame} emphasis={emphasis} />
    <ScorelineStrip data={data} theme={theme} />
    <div style={{ position: "relative", zIndex: 1, minHeight: 0 }}>{children}</div>
  </div>
);

const HookScene = ({ data, theme, localFrame }) => {
  const player = getPlayer(data);
  const segment = data.matchupSegment || {};
  const proofSegment = data.proofSegment || {};
  const displayPlayers = deriveMatchupDisplayPlayers(segment);
  const edgePlayer = displayPlayers.edgePlayer;
  const proofPlayer = proofSegment.player || player;
  const reasons = Array.isArray(segment.reasons) ? segment.reasons.slice(0, 3) : [];
  const primaryMatchupReason = reasons[0];
  const proofBadgeLabel = getProofBadgeLabel(proofSegment.proofType, data);
  const templateCopy = getTemplateCopy(data);
  const en = isEnglishLocale(data);
  const isSamePlayer = samePlayer(edgePlayer, proofPlayer);
  const roleLabel = getRoleLabel(edgePlayer.role || player.role, data);
  const openingEvidence = getOpeningEvidence(data);
  const headline = isSamePlayer
    ? (en ? `${proofPlayer.name} owns the ${roleLabel}` : `${proofPlayer.name} 打穿${roleLabel}`)
    : (en ? `${edgePlayer.name} gap, ${proofPlayer.name} case` : `${edgePlayer.name} 對位差，${proofPlayer.name} 關鍵人物`);
  const subline = en
    ? (isSamePlayer
      ? `Biggest matchup edge and ${proofBadgeLabel} land on one player`
      : `${edgePlayer.name} has the gap; ${proofPlayer.name} has the ${proofBadgeLabel}`)
    : (isSamePlayer
      ? `最大對位差和 ${proofBadgeLabel} 都在同一人`
      : `${edgePlayer.name} 是最大對位差，${proofPlayer.name} 是${proofBadgeLabel}`);

  return (
    <SceneShell data={data} theme={theme} localFrame={localFrame}>
      <MobileShortStage localFrame={localFrame}>
        <OnePointSceneBody gap={18}>
        <div>
          <PipelineBadge theme={theme} localFrame={localFrame}>{templateCopy.creatorRead}</PipelineBadge>
          <div style={{ marginTop: 20, color: "#fff", fontSize: 72, fontWeight: 950, lineHeight: 0.98, textWrap: "balance", textShadow: `0 0 46px ${theme.accent}55` }}>
            {headline}
          </div>
          <div style={{ marginTop: 12, color: theme.secondary, fontSize: 27, fontWeight: 950, lineHeight: 1.18 }}>
            {subline}
          </div>
        </div>
        <HeroNumber
          kicker={openingEvidence.label}
          value={openingEvidence.value}
          label={en ? "Start with the lane swing" : "先看這路贏在哪"}
          accent={HEXTECH_COLORS.gold}
          theme={theme}
        />
        <ShortMetricBar reason={primaryMatchupReason} segment={segment} theme={theme} data={data} />
        <BroadcastPanel
          accent={theme.accent}
          innerStyle={{ padding: "17px 20px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center" }}
          style={{ background: "rgba(3,8,18,0.68)" }}
        >
          <div style={{ color: theme.accent, fontSize: 17, fontWeight: 950, letterSpacing: 4 }}>{proofBadgeLabel}</div>
          <div style={{ color: "#fff", fontSize: 31, fontWeight: 950, lineHeight: 1, textAlign: "right" }}>
            {getHookProofPillValue(data)} · {getRoleLabel(proofPlayer.role || player.role, data)}
          </div>
        </BroadcastPanel>
        </OnePointSceneBody>
      </MobileShortStage>
    </SceneShell>
  );
};

const MatchupEdgeScene = ({ data, theme, localFrame }) => {
  const segment = data.matchupSegment || {};
  const copy = getPlayerRadarCopy(data);
  const displayPlayers = deriveMatchupDisplayPlayers(segment);
  const focusPlayer = displayPlayers.focusPlayer;
  const edgePlayer = displayPlayers.edgePlayer;
  const opponentPlayer = displayPlayers.opponentPlayer;
  const reasons = Array.isArray(segment.reasons) ? segment.reasons.slice(0, 3) : [];
  const primaryMatchupReason = reasons[0];
  const secondaryReasons = reasons.slice(1);
  const label = segment.edgeType === "loser-highlight" ? copy.matchupLoserHighlight : copy.matchupWinnerBreak;
  const templateCopy = getTemplateCopy(data);
  const roleLabel = getRoleLabel(segment.role || focusPlayer.role, data);
  const metric = primaryMatchupReason?.metric || templateCopy.primaryGap;
  const values = primaryMatchupReason ? getMatchupMetricDisplay(primaryMatchupReason, segment) : {};
  const delta = primaryMatchupReason ? formatMetricDelta(primaryMatchupReason.metric, primaryMatchupReason.delta) : "";
  const valueLine = primaryMatchupReason
    ? `${formatMetricValue(metric, values.leftValue)} vs ${formatMetricValue(metric, values.rightValue)}`
    : templateCopy.matchupEvidence(edgePlayer.name);

  return (
    <SceneShell data={data} theme={theme} localFrame={localFrame}>
      <MobileShortStage localFrame={localFrame}>
        <OnePointSceneBody gap={18}>
        <div>
          <div style={{ color: theme.accent, fontSize: 23, fontWeight: 950, letterSpacing: 5 }}>
            {roleLabel} MATCHUP · {label}
          </div>
          <div style={{ marginTop: 12, color: "#fff", fontSize: 66, fontWeight: 950, lineHeight: 1, textWrap: "balance", textShadow: `0 0 46px ${theme.accent}55` }}>
            {focusPlayer.name || edgePlayer.name} vs {opponentPlayer.name}
          </div>
          <div style={{ marginTop: 12, color: theme.secondary, fontSize: 27, fontWeight: 950, lineHeight: 1.18 }}>
            {templateCopy.matchupEvidence(edgePlayer.name)}
          </div>
        </div>
        <HeroNumber
          kicker={metric}
          value={delta}
          label={valueLine}
          accent={HEXTECH_COLORS.gold}
          theme={theme}
        />
        <ShortMetricBar reason={primaryMatchupReason} segment={segment} theme={theme} data={data} />
        <MobileStatChips reasons={secondaryReasons} segment={segment} theme={theme} />
        </OnePointSceneBody>
      </MobileShortStage>
    </SceneShell>
  );
};

const PlayerProofScene = ({ data, theme, localFrame }) => {
  const segment = data.proofSegment || {};
  const copy = getPlayerRadarCopy(data);
  const player = segment.player || {};
  const proofReasons = Array.isArray(segment.proofReasons) ? segment.proofReasons.slice(0, 3) : [];
  const proofLabel = segment.proofType === "mvp" ? copy.proofBadgeLabels.mvp : copy.proofBadgeLabels.key_player;
  const templateCopy = getTemplateCopy(data);
  const metricNames = proofReasons.map((reason) => reason.metric);
  const primaryProof = proofReasons[0];
  const primaryValue = primaryProof
    ? formatMetricValue(primaryProof.metric, primaryProof.rawValue)
    : getHookProofPillValue(data);
  const roleLine = [player.team, getRoleLabel(player.role, data)].filter(Boolean).join(" · ");
  const en = isEnglishLocale(data);

  return (
    <SceneShell data={data} theme={theme} localFrame={localFrame}>
      <MobileShortStage localFrame={localFrame}>
        <OnePointSceneBody gap={18}>
        <div>
          <PipelineBadge theme={theme} localFrame={localFrame}>{proofLabel}</PipelineBadge>
          <div style={{ marginTop: 18, color: "rgba(240,230,210,0.72)", fontSize: 22, fontWeight: 950, letterSpacing: 5 }}>
            {roleLine}
          </div>
          <div style={{ marginTop: 8, color: "#fff", fontSize: 80, fontWeight: 950, lineHeight: 0.96, textShadow: `0 0 46px ${theme.accent}55` }}>
            {player.name} {en ? "case" : "憑什麼"}
          </div>
          <div style={{ marginTop: 14, color: theme.secondary, fontSize: 26, fontWeight: 950, lineHeight: 1.2, textWrap: "balance" }}>
            {segment.verdict || data.verdict || copy.proofSubtitle}
          </div>
        </div>
        <HeroNumber
          kicker={primaryProof?.metric || templateCopy.proofWhyTitle}
          value={primaryValue}
          label={templateCopy.proofWhyBody(metricNames)}
          accent={HEXTECH_COLORS.gold}
          theme={theme}
        />
        <VerticalEvidenceStack proofReasons={proofReasons} theme={theme} data={data} />
        </OnePointSceneBody>
      </MobileShortStage>
    </SceneShell>
  );
};

const ChipRow = ({ chips = [], theme }) => {
  const visible = chips.filter(Boolean).slice(0, 3);
  if (visible.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {visible.map((chip) => (
        <div
          key={chip}
          style={{
            padding: "10px 15px",
            color: "#fff",
            fontSize: 19,
            fontWeight: 900,
            letterSpacing: 1.6,
            border: `1px solid ${theme.accent}44`,
            background: "rgba(255,255,255,0.055)",
            clipPath: BROADCAST_CLIP,
          }}
        >
          {chip}
        </div>
      ))}
    </div>
  );
};

const ConclusionScene = ({ data, theme, localFrame }) => {
  const verdict = buildConclusionVerdict(data);
  const segment = data.matchupSegment || {};
  const displayPlayers = deriveMatchupDisplayPlayers(segment);
  const proofPlayer = data.proofSegment?.player || {};
  const edgePlayer = displayPlayers.edgePlayer || {};
  const reason = Array.isArray(segment.reasons) ? segment.reasons[0] : null;
  const en = isEnglishLocale(data);
  const templateCopy = getTemplateCopy(data);
  const roleLabel = getRoleLabel(edgePlayer.role || segment.role, data);
  const body = samePlayer(edgePlayer, proofPlayer)
    ? (en
      ? `${proofPlayer.name} owns the ${roleLabel} gap and the MVP case.`
      : `${proofPlayer.name} 同時拿下${roleLabel}差距和 MVP 理由。`)
    : verdict.body;
  const chips = reason
    ? [roleLabel, `${reason.metric} ${formatMetricDelta(reason.metric, reason.delta)}`, ...(verdict.chips || []).slice(0, 1)]
    : verdict.chips;
  const title = verdict.isSamePlayer ? templateCopy.conclusionTitleSame : templateCopy.conclusionTitleSplit;

  return (
    <SceneShell data={data} theme={theme} localFrame={localFrame} emphasis="verdict">
      <MobileShortStage localFrame={localFrame} offset={10}>
        <OnePointSceneBody gap={18}>
        <BroadcastPanel
          accent={HEXTECH_COLORS.gold}
          innerStyle={{ padding: "36px 32px", display: "grid", gap: 20, textAlign: "center" }}
          style={{ background: "linear-gradient(135deg, rgba(35,25,8,0.9), rgba(4,17,31,0.92) 48%, rgba(4,9,18,0.96))" }}
        >
          <PipelineBadge theme={theme} localFrame={localFrame}>{en ? "FINAL READ" : "最後結論"}</PipelineBadge>
          <div style={{ color: HEXTECH_COLORS.gold, fontSize: 31, fontWeight: 950, letterSpacing: 5 }}>
            {title}
          </div>
          <div style={{ color: "#fff", fontSize: 55, fontWeight: 950, lineHeight: 1.08, textWrap: "balance" }}>
            {body}
          </div>
          <ChipRow chips={chips} theme={theme} />
        </BroadcastPanel>
        </OnePointSceneBody>
      </MobileShortStage>
    </SceneShell>
  );
};

export const Template_PlayerRadar = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = getPipelineTheme("PLAYER_RADAR");
  const storyboard = buildRadarStoryboard(data);
  const timeline = buildTimeline(storyboard, fps, 0);
  const active = getActiveTimelineScene(timeline, frame);
  const tag = active.scene?.tag || "HOOK";

  const renderScene = () => {
    if (active.scene?.tag === "MATCHUP_EDGE") return <MatchupEdgeScene data={data} theme={theme} localFrame={active.localFrame} />;
    if (active.scene?.tag === "PLAYER_PROOF") return <PlayerProofScene data={data} theme={theme} localFrame={active.localFrame} />;
    if (tag === "CONCLUSION_CTA" || tag === "OUTRO") return <ConclusionScene data={data} theme={theme} localFrame={active.localFrame} />;
    return <HookScene data={data} theme={theme} localFrame={active.localFrame} />;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#07111f", color: "#fff", fontFamily: "'Outfit', 'Noto Sans TC', sans-serif", overflow: "hidden" }}>
      <HextechBackground tactical />
      <PipelineChrome theme={theme} left="PLAYER RADAR" right="MATCH DATA / PERFORMANCE" />
      <BgmLayer bgmFile={data.bgmFile} audioPlan={data.audioPlan || data.postMatchRead?.audioPlan} />
      <SafeStage inset={PLAYER_RADAR_STAGE_INSET}>{renderScene()}</SafeStage>
      <SubtitleCaption
        scene={active.scene}
        activeStart={active.start}
        accent={theme.accent}
        bottom={PLAYER_RADAR_SUBTITLE_BOTTOM}
        variant="lowerThird"
      />
    </AbsoluteFill>
  );
};
