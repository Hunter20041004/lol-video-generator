import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame } from "remotion";
import { resolveRenderAssetSrc } from "./renderAssetSrc";

export const HEXTECH_COLORS = {
  gold: "#C8AA6E",
  goldLight: "#F0E6D2",
  cyan: "#0AC8B9",
  cyanSoft: "#7dd3fc",
  red: "#ef4444",
  green: "#10b981",
  bg: "#050A0E",
};

const HexParticles = ({ opacity = 0.16 }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      {Array.from({ length: 26 }, (_, i) => {
        const left = (i * 131) % 100;
        const top = (i * 73) % 100;
        const drift = Math.sin((frame + i * 19) / 44) * 12;
        const size = 8 + (i % 4) * 5;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              border: "1px solid rgba(200,170,110,0.55)",
              transform: `translate(${drift}px, ${drift * 0.55}px) rotate(${45 + frame * 0.12}deg)`,
              boxShadow: "0 0 16px rgba(10,200,185,0.35)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const isVideoUrl = (url = "") => /\.(webm|mp4|mov|m4v)(\?.*)?$/i.test(String(url));

export const HextechBackground = ({ splashUrl, dimmed = false, tactical = false }) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 650], [1.05, 1.22], { extrapolateRight: "clamp" });
  const mediaIsVideo = isVideoUrl(splashUrl);
  const mediaSrc = resolveRenderAssetSrc(splashUrl);

  return (
    <>
      <AbsoluteFill
        style={{
          background: [
            "radial-gradient(circle at 50% 15%, rgba(10,200,185,0.22), transparent 32%)",
            "radial-gradient(circle at 50% 84%, rgba(200,170,110,0.16), transparent 38%)",
            "linear-gradient(180deg, #06101f 0%, #091a31 46%, #020611 100%)",
          ].join(", "),
        }}
      />

      {splashUrl ? (
        <AbsoluteFill style={{ transform: `scale(${zoom})`, opacity: tactical ? 0.32 : 0.62 }}>
          {mediaIsVideo ? (
            <OffthreadVideo
              src={mediaSrc}
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: dimmed || tactical ? "blur(9px) brightness(0.45) saturate(1.2)" : "brightness(0.82) saturate(1.08)",
              }}
            />
          ) : (
            <Img
              src={mediaSrc}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: dimmed || tactical ? "blur(9px) brightness(0.45) saturate(1.2)" : "brightness(0.82) saturate(1.08)",
              }}
            />
          )}
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(200,170,110,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(10,200,185,0.06) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
          opacity: 0.42,
        }}
      />

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(2,6,14,0.82), transparent 24%, transparent 76%, rgba(2,6,14,0.82)), linear-gradient(180deg, rgba(2,6,14,0.42), transparent 48%, rgba(2,6,14,0.78))",
        }}
      />

      <HexParticles opacity={tactical ? 0.22 : 0.15} />

      <div
        style={{
          position: "absolute",
          inset: 46,
          border: "3px solid rgba(200,170,110,0.68)",
          boxShadow: "0 0 42px rgba(10,200,185,0.18), inset 0 0 55px rgba(3,10,20,0.82)",
          clipPath: "polygon(28px 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%, 0 28px)",
        }}
      />
    </>
  );
};

export const glassPanel = (accent = HEXTECH_COLORS.cyan) => ({
  background: "linear-gradient(135deg, rgba(10,20,40,0.62), rgba(2,6,14,0.48))",
  border: `1px solid ${accent}66`,
  boxShadow: `0 18px 46px rgba(0,0,0,0.36), 0 0 30px ${accent}30, inset 0 1px 0 rgba(255,255,255,0.14)`,
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
});
