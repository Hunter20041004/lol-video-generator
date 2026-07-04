"use client";
import React from "react";

export const ModeSwitch = ({ modes, value, onChange }) => (
  <div style={{ display: "inline-flex", gap: 8, padding: 6, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(200,170,110,0.24)", marginTop: 18 }}>
    {Object.entries(modes || {}).map(([key, label]) => {
      const selected = value === key;
      return (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: "9px 18px",
            cursor: "pointer",
            border: selected ? "1px solid var(--hex-gold)" : "1px solid transparent",
            background: selected ? "var(--hex-gold)" : "transparent",
            color: selected ? "#000" : "var(--hex-gold)",
            fontFamily: "Cinzel",
            fontWeight: 900,
            letterSpacing: 1.5,
            transition: "all 0.2s ease",
          }}
        >
          {label}
        </button>
      );
    })}
  </div>
);
