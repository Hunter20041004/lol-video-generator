import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { splitCaptionHighlightSegments } from "./captionHighlight";

const LOWER_THIRD_FONT_SIZE = 30;
const LOWER_THIRD_MAX_WIDTH = 700;
const LOWER_THIRD_WIDTH = "66%";

const sanitizeCaptionText = (text) =>
  String(text || "")
    .replace(/\s*\n\s*([？。，！?!,.；：、）」』])/g, "$1")
    .replace(/^\s*\n+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 2)
    .join("\n");

export const SubtitleCaption = ({ scene, activeStart = 0, accent = "#C8AA6E", bottom = 340, variant = "card" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cleanedText = sanitizeCaptionText(scene?.text);

  if (!cleanedText) return null;

  const pop = spring({
    frame: Math.max(0, frame - activeStart),
    fps,
    config: { stiffness: 290, damping: 17, mass: 0.62 },
  });
  const isLowerThird = variant === "lowerThird";
  const lowerThirdFont = "'Noto Sans TC', 'PingFang TC', 'Heiti TC', sans-serif";
  const enterY = isLowerThird ? 0 : interpolate(pop, [0, 1], [22, 0]);
  const enterScale = isLowerThird ? 1 : interpolate(pop, [0, 1], [0.94, 1]);
  const enterOpacity = isLowerThird ? 1 : interpolate(pop, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: "7%",
        right: "7%",
        bottom,
        zIndex: 1000,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
        transform: `translate3d(0, ${enterY}px, 0) scale(${enterScale})`,
        opacity: enterOpacity,
        willChange: isLowerThird ? undefined : "opacity, transform",
      }}
    >
      <div
        style={{
          maxWidth: isLowerThird ? LOWER_THIRD_MAX_WIDTH : 860,
          width: isLowerThird ? LOWER_THIRD_WIDTH : "fit-content",
          minWidth: isLowerThird ? "unset" : "52%",
          padding: isLowerThird ? "12px 34px 14px" : "22px 34px 24px",
          borderRadius: isLowerThird ? 2 : 24,
          border: isLowerThird ? "none" : `1.5px solid ${accent}99`,
          background: isLowerThird
            ? "rgba(5, 10, 18, 0.94)"
            : "linear-gradient(135deg, rgba(4,10,22,0.78), rgba(9,25,45,0.62))",
          boxShadow: isLowerThird
            ? "0 16px 32px rgba(0,0,0,0.52), inset 0 0 0 1px rgba(200,170,110,0.28)"
            : `0 18px 44px rgba(0,0,0,0.54), 0 0 28px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.12)`,
          backdropFilter: isLowerThird ? undefined : "blur(10px)",
          WebkitBackdropFilter: isLowerThird ? undefined : "blur(10px)",
          position: "relative",
          overflow: "hidden",
          clipPath: undefined,
          transform: undefined,
          backfaceVisibility: "hidden",
          contain: "layout paint",
        }}
      >
        {!isLowerThird ? (
          <div
            style={{
              position: "absolute",
              left: 24,
              right: 24,
              top: 0,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              opacity: 0.85,
            }}
          />
        ) : null}
        {isLowerThird ? (
          <>
            <div
              style={{
                position: "absolute",
                left: 18,
                top: "50%",
                width: 9,
                height: 9,
                background: accent,
                transform: "translateY(-50%) rotate(45deg)",
                boxShadow: "0 0 10px rgba(200,170,110,0.55)",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 18,
                top: "50%",
                width: 9,
                height: 9,
                background: accent,
                transform: "translateY(-50%) rotate(45deg)",
                boxShadow: "0 0 10px rgba(200,170,110,0.55)",
              }}
            />
          </>
        ) : null}
        <h2
          style={{
            margin: 0,
            color: isLowerThird ? "#F0E6D2" : "#fff",
            fontSize: isLowerThird ? LOWER_THIRD_FONT_SIZE : 46,
            fontFamily: isLowerThird ? lowerThirdFont : "'Outfit', 'Noto Sans TC', sans-serif",
            fontWeight: isLowerThird ? 850 : 900,
            letterSpacing: 0,
            lineHeight: isLowerThird ? 1.18 : 1.22,
            textAlign: "center",
            whiteSpace: "pre-line",
            wordBreak: "keep-all",
            overflowWrap: "break-word",
            textShadow: isLowerThird
              ? "0 2px 0 rgba(0,0,0,0.95), 0 8px 18px rgba(0,0,0,0.9)"
              : "0 3px 14px rgba(0,0,0,0.9)",
          }}
        >
          {splitCaptionHighlightSegments(cleanedText).map((part, i) => {
            if (part.highlighted) {
              return (
                <span key={i} style={{ color: accent, textShadow: `0 0 16px ${accent}88` }}>
                  {part.text}
                </span>
              );
            }
            return part.text;
          })}
        </h2>
      </div>
    </div>
  );
};
