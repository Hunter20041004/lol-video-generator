"use client";
import React from "react";

export const ImageWithFallback = ({ src, alt, fallbackText = "?", style = {}, ...props }) => {
  if (!src) {
    return (
      <div
        aria-label={alt || fallbackText}
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--hex-gold)",
          fontWeight: 900,
          background: style.background || "rgba(0,0,0,0.45)",
        }}
      >
        {String(fallbackText || "?").slice(0, 1)}
      </div>
    );
  }

  return <img src={src} alt={alt || ""} style={style} {...props} />;
};
