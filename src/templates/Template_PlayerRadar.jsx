import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BgmLayer } from "../video-system/BgmLayer";
import { buildTimeline } from "../video-system/pacing";
import { resolveRenderAssetSrc } from "../video-system/renderAssetSrc";

const COLORS = {
  ink: "#010A13",
  navy: "#0A1428",
  gold: "#C8AA6E",
  darkGold: "#785A28",
  teal: "#0AC8B9",
  ice: "#CDFAFA",
  parchment: "#F0E6D2",
};

const DISPLAY_FONT = "'Noto Serif TC Post Match Read', serif";
const NUMBER_FONT = "'Cinzel', serif";
const LABEL_FONT = "'Outfit', sans-serif";
const MAX_CROSSFADE_FRAMES = 8;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const findScene = (timeline, tag) => timeline.find((scene) => scene.tag === tag);

const sceneOpacity = (scene, frame) => {
  if (!scene) return 0;
  const local = frame - scene.start;
  const enter = interpolate(local, [0, MAX_CROSSFADE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const exit = interpolate(
    local,
    [scene.duration - MAX_CROSSFADE_FRAMES, scene.duration],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  return scene.tag === "CONCLUSION_CTA" ? enter : Math.min(enter, exit);
};

const localSceneFrame = (timeline, tag, frame) => {
  const scene = findScene(timeline, tag);
  return scene ? clamp(frame - scene.start, 0, scene.duration) : 0;
};

const reveal = (localFrame, start = 0, distance = 22) => {
  const opacity = interpolate(localFrame, [start, start + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const translateY = interpolate(localFrame, [start, start + 12], [distance, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return { opacity, transform: `translate3d(0, ${translateY}px, 0)` };
};

const HeroAsset = ({ asset, side, opacity, scale }) => {
  if (!asset?.src) return null;
  const isLeft = side === "left";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        clipPath: isLeft
          ? "polygon(0 0, 61% 0, 49% 100%, 0 100%)"
          : "polygon(53% 0, 100% 0, 100% 100%, 41% 100%)",
        opacity,
        overflow: "hidden",
      }}
    >
      {asset.mode === "square-map" && asset.mapSrc ? (
        <Img
          src={resolveRenderAssetSrc(asset.mapSrc)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.35) saturate(0.72)",
          }}
        />
      ) : null}
      <Img
        src={resolveRenderAssetSrc(asset.src)}
        style={{
          position: "absolute",
          inset: asset.mode === "square-map" ? "20% 4% 18%" : "-2% -10% 0",
          width: asset.mode === "square-map" ? "92%" : "120%",
          height: asset.mode === "square-map" ? "62%" : "102%",
          objectFit: asset.mode === "square-map" ? "contain" : "cover",
          objectPosition: isLeft ? "62% center" : "38% center",
          transform: `scale(${scale}) ${isLeft ? "" : "scaleX(-1)"}`,
          filter: "saturate(0.9) contrast(1.08) brightness(0.72)",
        }}
      />
    </div>
  );
};

const HeroField = ({ model, frame, timeline }) => {
  const assets = model.assets || {};
  const proofStart = findScene(timeline, "PLAYER_PROOF")?.start || 150;
  const verdictStart = findScene(timeline, "CONCLUSION_CTA")?.start || 270;
  const heroFrame = frame >= verdictStart ? verdictStart + Math.min(frame - verdictStart, 60) : frame;
  const scale = interpolate(heroFrame, [0, 360], [1, 1.028], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const matchupOpacity = interpolate(frame, [proofStart - 8, proofStart + 8], [1, 0.26], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const proofOpacity = interpolate(frame, [proofStart - 8, proofStart + 12], [0, 0.82], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const verdictDim = interpolate(frame, [verdictStart, verdictStart + 18], [0, 0.54], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{ position: "absolute", inset: "0 0 33%", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 38%, rgba(10,200,185,0.16), transparent 34%), linear-gradient(180deg, #0A1428 0%, #010A13 91%)",
        }}
      />
      <HeroAsset asset={assets.matchup?.edge} side="left" opacity={matchupOpacity} scale={scale} />
      <HeroAsset asset={assets.matchup?.opponent} side="right" opacity={matchupOpacity} scale={scale} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: proofOpacity,
          background:
            "radial-gradient(ellipse at 50% 48%, rgba(10,200,185,0.22), transparent 36%), linear-gradient(90deg, rgba(1,10,19,0.9), transparent 28%, transparent 72%, rgba(1,10,19,0.9))",
        }}
      >
        {(assets.proof?.champions || []).slice(0, 3).map((champion, index) =>
          champion.src ? (
            <Img
              key={champion.championName}
              src={resolveRenderAssetSrc(champion.src)}
              style={{
                position: "absolute",
                width: index === 1 ? 390 : 300,
                height: index === 1 ? 390 : 300,
                objectFit: "cover",
                left: index === 0 ? 54 : index === 1 ? 345 : 726,
                top: index === 1 ? 300 : 420,
                clipPath: "polygon(50% 0, 94% 25%, 94% 75%, 50% 100%, 6% 75%, 6% 25%)",
                border: `2px solid ${index === 1 ? COLORS.gold : COLORS.teal}`,
                filter: index === 1 ? "brightness(0.94)" : "brightness(0.58) saturate(0.8)",
              }}
            />
          ) : null,
        )}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.ink,
          opacity: verdictDim,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "44% 0 0",
          background: "linear-gradient(180deg, transparent, #010A13 82%)",
        }}
      />
    </div>
  );
};

const SharedHextechThread = ({ frame, timeline }) => {
  const proofStart = findScene(timeline, "PLAYER_PROOF")?.start || 150;
  const verdictStart = findScene(timeline, "CONCLUSION_CTA")?.start || 270;
  const progressFrame = frame >= verdictStart ? verdictStart + Math.min(frame - verdictStart, 60) : frame;
  const rotation = interpolate(progressFrame, [0, proofStart, verdictStart + 60], [-16, -2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 185,
        width: 3,
        height: 1470,
        transform: `translateX(-50%) rotate(${rotation}deg)`,
        transformOrigin: "50% 50%",
        background: `linear-gradient(180deg, transparent, ${COLORS.gold} 18%, ${COLORS.ice} 54%, transparent)`,
        boxShadow: "0 0 42px rgba(10,200,185,0.32), 0 0 18px rgba(200,170,110,0.66)",
        opacity: 0.92,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -8,
          top: "38%",
          width: 19,
          height: 19,
          transform: "rotate(45deg)",
          border: `2px solid ${COLORS.gold}`,
          background: COLORS.ink,
        }}
      />
    </div>
  );
};

const BrandLine = ({ title, context }) => (
  <div
    style={{
      position: "absolute",
      top: 72,
      left: 64,
      right: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontFamily: LABEL_FONT,
      color: COLORS.parchment,
      zIndex: 10,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ width: 34, height: 2, background: COLORS.gold }} />
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: 6 }}>{title}</div>
    </div>
    <div style={{ fontSize: 19, letterSpacing: 2.4, color: COLORS.ice }}>
      {[context?.league, context?.teamA && context?.teamB ? `${context.teamA} ${context.score || ""} ${context.teamB}` : ""]
        .filter(Boolean)
        .join("  ·  ")}
    </div>
  </div>
);

const SourceLine = ({ context }) => (
  <div
    style={{
      position: "absolute",
      left: 64,
      right: 64,
      bottom: 168,
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      gap: 20,
      color: COLORS.darkGold,
      fontFamily: LABEL_FONT,
      fontSize: 17,
      letterSpacing: 3.2,
      zIndex: 10,
    }}
  >
    <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.darkGold})` }} />
    <div>{context?.gameCount || 3}-GAME SERIES DATA · VERIFIED SNAPSHOT</div>
    <div style={{ height: 1, background: `linear-gradient(90deg, ${COLORS.darkGold}, transparent)` }} />
  </div>
);

const SceneLayer = ({ timeline, frame, tag, children }) => {
  const scene = findScene(timeline, tag);
  return (
    <AbsoluteFill
      style={{
        opacity: sceneOpacity(scene, frame),
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Eyebrow = ({ children }) => (
  <div
    style={{
      fontFamily: LABEL_FONT,
      color: COLORS.ice,
      fontSize: 22,
      fontWeight: 600,
      letterSpacing: 5,
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);

const HeroNumber = ({ children, size = 156, color = COLORS.gold }) => (
  <div
    style={{
      fontFamily: NUMBER_FONT,
      color,
      fontSize: size,
      fontWeight: 700,
      lineHeight: 0.9,
      letterSpacing: -4,
      fontVariantNumeric: "tabular-nums",
      textShadow: `0 0 38px ${color}42`,
    }}
  >
    {children}
  </div>
);

const HookScene = ({ model, frame, timeline }) => {
  const local = localSceneFrame(timeline, "HOOK", frame);
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: 1040,
        textAlign: "center",
        display: "grid",
        justifyItems: "center",
        gap: 18,
      }}
    >
      <div style={reveal(local, 4, 16)}>
        <Eyebrow>{model.hook?.metric || "KDA"} · {model.seriesContext?.gameCount || 3}-GAME SERIES</Eyebrow>
      </div>
      <div style={reveal(local, 10, 22)}>
        <HeroNumber>{model.hook?.displayValue}</HeroNumber>
      </div>
      <div
        style={{
          ...reveal(local, 18, 20),
          maxWidth: 850,
          fontFamily: DISPLAY_FONT,
          color: COLORS.parchment,
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1.24,
        }}
      >
        {model.hook?.question}
      </div>
    </div>
  );
};

const PlayerRead = ({ player, value, align = "left", accent = COLORS.gold }) => (
  <div style={{ textAlign: align, minWidth: 360 }}>
    <div
      style={{
        fontFamily: NUMBER_FONT,
        fontSize: 43,
        color: COLORS.parchment,
        letterSpacing: 1,
      }}
    >
      {player?.name}
    </div>
    <div
      style={{
        marginTop: 8,
        fontFamily: NUMBER_FONT,
        fontSize: 68,
        fontWeight: 700,
        color: accent,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value} <span style={{ fontFamily: LABEL_FONT, fontSize: 25 }}>KDA</span>
    </div>
  </div>
);

const MatchupScene = ({ model, frame, timeline }) => {
  const local = localSceneFrame(timeline, "MATCHUP_EDGE", frame);
  const matchup = model.matchup || {};
  const reason = matchup.reasons?.[0] || {};
  const role = String(matchup.role || "Jungle").toUpperCase();
  return (
    <div style={{ position: "absolute", inset: "970px 62px 120px" }}>
      <div style={{ ...reveal(local, 3, 18), display: "flex", justifyContent: "center", gap: 16, alignItems: "center" }}>
        {model.assets?.smiteSrc ? (
          <Img src={resolveRenderAssetSrc(model.assets.smiteSrc)} style={{ width: 44, height: 44 }} />
        ) : null}
        <Eyebrow>{role} · {model.seriesContext?.gameCount || 3}-GAME SERIES AVERAGE</Eyebrow>
      </div>
      <div
        style={{
          ...reveal(local, 11, 24),
          marginTop: 48,
          display: "grid",
          gridTemplateColumns: "1fr 72px 1fr",
          alignItems: "center",
        }}
      >
        <PlayerRead player={matchup.edgePlayer} value={Number(reason.winnerValue).toFixed(1)} />
        <div style={{ textAlign: "center", fontFamily: LABEL_FONT, color: COLORS.darkGold, fontSize: 24 }}>VS</div>
        <PlayerRead
          player={matchup.opponentPlayer}
          value={Number(reason.loserValue).toFixed(2)}
          align="right"
          accent={COLORS.ice}
        />
      </div>
      <div
        style={{
          ...reveal(local, 22, 20),
          margin: "66px auto 0",
          maxWidth: 870,
          textAlign: "center",
          fontFamily: DISPLAY_FONT,
          fontSize: 49,
          lineHeight: 1.3,
          color: COLORS.parchment,
        }}
      >
        {model.storyboard?.find((scene) => scene.tag === "MATCHUP_EDGE")?.text}
      </div>
    </div>
  );
};

const ChampionPool = ({ champions = [] }) => (
  <div style={{ display: "flex", justifyContent: "center", gap: 18 }}>
    {champions.slice(0, 3).map((champion) => (
      <div
        key={champion}
        style={{
          fontFamily: LABEL_FONT,
          fontSize: 21,
          letterSpacing: 2.4,
          color: COLORS.ice,
          borderBottom: `1px solid ${COLORS.teal}`,
          padding: "0 3px 8px",
        }}
      >
        {champion}
      </div>
    ))}
  </div>
);

const ProofScene = ({ model, frame, timeline }) => {
  const local = localSceneFrame(timeline, "PLAYER_PROOF", frame);
  const proof = model.proof || {};
  const player = proof.player || {};
  const rawStats = player.rawStats || {};
  const dpm = rawStats.dpm ?? proof.proofReasons?.find((reason) => reason.metric === "DPM")?.rawValue;
  const csm = rawStats.csm ?? proof.proofReasons?.find((reason) => reason.metric === "CSM")?.rawValue;
  return (
    <div
      style={{
        position: "absolute",
        inset: "920px 72px 105px",
        display: "grid",
        justifyItems: "center",
        alignContent: "start",
        textAlign: "center",
      }}
    >
      <div style={reveal(local, 2, 16)}><Eyebrow>{proof.label} · {player.name}</Eyebrow></div>
      <div style={{ ...reveal(local, 10, 22), marginTop: 30 }}>
        <HeroNumber size={162} color={COLORS.gold}>{dpm} <span style={{ fontSize: 40 }}>DPM</span></HeroNumber>
      </div>
      <div
        style={{
          ...reveal(local, 18, 18),
          marginTop: 30,
          fontFamily: NUMBER_FONT,
          color: COLORS.ice,
          fontSize: 44,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {csm} <span style={{ fontFamily: LABEL_FONT, fontSize: 24 }}>CS / MIN</span>
      </div>
      <div style={{ ...reveal(local, 27, 16), marginTop: 34 }}>
        <ChampionPool champions={player.champions || []} />
      </div>
      <div
        style={{
          ...reveal(local, 36, 18),
          marginTop: 46,
          maxWidth: 850,
          fontFamily: DISPLAY_FONT,
          fontSize: 45,
          lineHeight: 1.32,
          color: COLORS.parchment,
        }}
      >
        {model.storyboard?.find((scene) => scene.tag === "PLAYER_PROOF")?.text}
      </div>
    </div>
  );
};

const VerdictScene = ({ model, frame, timeline }) => {
  const unclamped = localSceneFrame(timeline, "CONCLUSION_CTA", frame);
  const local = Math.min(unclamped, 60);
  const text = model.storyboard?.find((scene) => scene.tag === "CONCLUSION_CTA")?.text || "";
  const [verdict, cta] = text.split("\n");
  const matchup = model.matchup || {};
  const proof = model.proof || {};
  const reason = matchup.reasons?.[0] || {};
  const dpm = proof.player?.rawStats?.dpm ?? proof.proofReasons?.find((item) => item.metric === "DPM")?.rawValue;
  return (
    <div
      style={{
        position: "absolute",
        inset: "760px 78px 180px",
        display: "grid",
        justifyItems: "center",
        alignContent: "center",
        textAlign: "center",
      }}
    >
      <div style={reveal(local, 4, 16)}><Eyebrow>FINAL READ</Eyebrow></div>
      <div
        style={{
          ...reveal(local, 12, 24),
          marginTop: 32,
          maxWidth: 900,
          fontFamily: DISPLAY_FONT,
          color: COLORS.parchment,
          fontSize: 66,
          fontWeight: 700,
          lineHeight: 1.32,
        }}
      >
        {verdict}
      </div>
      <div
        style={{
          ...reveal(local, 25, 18),
          marginTop: 48,
          display: "flex",
          gap: 50,
          fontFamily: NUMBER_FONT,
          color: COLORS.gold,
          fontSize: 34,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{matchup.edgePlayer?.name} {Number(reason.winnerValue).toFixed(1)} KDA</span>
        <span>{proof.player?.name} {dpm} DPM</span>
      </div>
      <div
        style={{
          ...reveal(local, 38, 14),
          marginTop: 70,
          fontFamily: DISPLAY_FONT,
          color: COLORS.ice,
          fontSize: 38,
          letterSpacing: 1,
        }}
      >
        {cta}
      </div>
    </div>
  );
};

export const Template_PlayerRadar = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const model = data.postMatchRead;
  const timeline = buildTimeline(model.storyboard, fps, 0);

  return (
    <AbsoluteFill style={{ background: COLORS.ink, color: COLORS.parchment, overflow: "hidden" }}>
      <HeroField model={model} frame={frame} timeline={timeline} />
      <SharedHextechThread frame={frame} timeline={timeline} />
      <BrandLine title="POST MATCH READ" context={model.seriesContext} />
      <SourceLine context={model.seriesContext} />
      <SceneLayer timeline={timeline} frame={frame} tag="HOOK"><HookScene model={model} frame={frame} timeline={timeline} /></SceneLayer>
      <SceneLayer timeline={timeline} frame={frame} tag="MATCHUP_EDGE"><MatchupScene model={model} frame={frame} timeline={timeline} /></SceneLayer>
      <SceneLayer timeline={timeline} frame={frame} tag="PLAYER_PROOF"><ProofScene model={model} frame={frame} timeline={timeline} /></SceneLayer>
      <SceneLayer timeline={timeline} frame={frame} tag="CONCLUSION_CTA"><VerdictScene model={model} frame={frame} timeline={timeline} /></SceneLayer>
      <BgmLayer bgmFile={data.bgmFile} audioPlan={model.audioPlan || data.audioPlan} />
    </AbsoluteFill>
  );
};
