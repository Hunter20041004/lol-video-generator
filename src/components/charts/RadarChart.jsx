import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

// 數學：給一個 0~1 的「半徑比例」與「軸 index 0~N-1」，回傳該頂點的 (x, y)。
// 五邊形軸從正上方（angle = -90°）順時鐘排：北 → 東北 → 東南 → 西南 → 西北
const polarToXY = (cx, cy, radius, axisIndex, axisCount) => {
  const angle = (Math.PI * 2 * axisIndex) / axisCount - Math.PI / 2;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// =========================================================================
// 動畫：所有頂點從中心 (0,0) 一起 expand 到最終座標，前 30 frame 完成
// 多邊形 fill / stroke 在 expand 過程同步漸入；軸標籤 fade in 跟隨
// =========================================================================
export const RadarChart = ({
  radarStats,            // [{ label, rawValue, normalizedScore }] (恰 5 個)
  size = 720,
  fillColor = "#0AC8B9",      // 主色：cyan
  strokeColor = "#0AC8B9",
  highlightLabel = "",        // 對應 stats[].label 的某一項，會多畫一個 ring 標示
  appearStartFrame = 0,       // 從第幾 frame 開始展開 (給 Sequence 內部用 0 即可)
  expandDuration = 30,        // 展開動畫長度（frame）
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 安全化：保證恰 5 個 entry，缺的補 0、多的截掉
  const stats = (Array.isArray(radarStats) ? radarStats.slice(0, 5) : []);
  while (stats.length < 5) stats.push({ label: `?${stats.length + 1}`, rawValue: "—", normalizedScore: 0 });

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const axisCount = 5;

  // 展開進度 0~1 — spring 擺脫線性、給雷達圖一點生命感
  const expandProgress = spring({
    frame: frame - appearStartFrame,
    fps,
    durationInFrames: expandDuration,
    config: { stiffness: 90, damping: 14, mass: 0.9 },
  });
  // clamp 到 [0, 1]，避免 spring overshoot 把雷達圖推出格線
  const expand = clamp01(expandProgress);

  // 同心五邊形 grid（4 圈：25 / 50 / 75 / 100%）
  const gridRings = [0.25, 0.5, 0.75, 1].map((ratio, idx) => {
    const points = Array.from({ length: axisCount }, (_, i) => {
      const p = polarToXY(cx, cy, radius * ratio, i, axisCount);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(" ");
    return (
      <polygon
        key={`grid-${idx}`}
        points={points}
        fill="none"
        stroke="#2a3340"
        strokeWidth={1.5}
        opacity={0.65}
      />
    );
  });

  // 軸線（從中心放射到外環）
  const axisLines = Array.from({ length: axisCount }, (_, i) => {
    const outer = polarToXY(cx, cy, radius, i, axisCount);
    return (
      <line
        key={`axis-${i}`}
        x1={cx}
        y1={cy}
        x2={outer.x}
        y2={outer.y}
        stroke="#2a3340"
        strokeWidth={1.5}
        opacity={0.7}
      />
    );
  });

  // 數據多邊形 — 每個頂點半徑 = (normalizedScore / 100) × expand
  const dataPoints = stats.map((s, i) => {
    const score = clamp01((Number(s.normalizedScore) || 0) / 100);
    const r = radius * score * expand;
    return polarToXY(cx, cy, r, i, axisCount);
  });
  const dataPolygonPoints = dataPoints
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  // 多邊形 fill / stroke 透明度跟著 expand 進場
  const polygonOpacity = interpolate(expand, [0, 1], [0, 1]);

  // 軸標籤位置（在外環之外 ~58px 處，避免壓在多邊形上）
  const axisLabels = stats.map((s, i) => {
    const labelPos = polarToXY(cx, cy, radius + 58, i, axisCount);
    const isHighlight = highlightLabel && s.label === highlightLabel;
    const labelAppear = interpolate(
      frame - appearStartFrame,
      [expandDuration * 0.5, expandDuration],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return (
      <g key={`label-${i}`} opacity={labelAppear}>
        {/* 標籤文字 */}
        <text
          x={labelPos.x}
          y={labelPos.y - 8}
          fill={isHighlight ? "#FFD24A" : "#C8AA6E"}
          fontSize={26}
          fontWeight={900}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ letterSpacing: 3 }}
        >
          {s.label || "?"}
        </text>
        {/* 原始數值（rawValue），小一級放在 label 下方 */}
        <text
          x={labelPos.x}
          y={labelPos.y + 22}
          fill="#fff"
          fontSize={22}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
          opacity={0.92}
        >
          {String(s.rawValue ?? "—")}
        </text>
      </g>
    );
  });

  // 頂點圓點（最終位置才畫，跟著多邊形動畫）
  const dataDots = dataPoints.map((p, i) => {
    const score = (Number(stats[i].normalizedScore) || 0);
    return (
      <circle
        key={`dot-${i}`}
        cx={p.x}
        cy={p.y}
        r={9}
        fill={score >= 80 ? "#FFD24A" : strokeColor}
        stroke="#fff"
        strokeWidth={2.5}
        opacity={polygonOpacity}
      />
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: "visible" }}
    >
      {/* 背景發光光暈（展開時跟著膨脹）*/}
      <defs>
        <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.18" />
          <stop offset="70%" stopColor={fillColor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={radius * 0.95 * expand} fill="url(#radarGlow)" />

      {/* 軸線 + 同心 grid */}
      {axisLines}
      {gridRings}

      {/* 數據多邊形（半透明 fill + 實線 stroke） */}
      <polygon
        points={dataPolygonPoints}
        fill={fillColor}
        fillOpacity={0.3 * polygonOpacity}
        stroke={strokeColor}
        strokeWidth={3.5}
        strokeOpacity={polygonOpacity}
        style={{
          filter: `drop-shadow(0 0 12px ${strokeColor}aa)`,
        }}
      />

      {/* 頂點 circle */}
      {dataDots}

      {/* 軸標籤（label + rawValue） */}
      {axisLabels}
    </svg>
  );
};
