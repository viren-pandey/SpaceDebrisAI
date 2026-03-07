import { useMemo } from "react";

export default function SatelliteBackground() {
  const stars = useMemo(() =>
    Array.from({ length: 180 }, (_, i) => ({
      id: i,
      top:  `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 2.2 + 0.4,
      delay:    `${(Math.random() * 9).toFixed(2)}s`,
      duration: `${(3 + Math.random() * 6).toFixed(2)}s`,
    })), []);

  const streaks = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      top:      `${12 + Math.random() * 76}%`,
      width:    `${70 + Math.random() * 130}px`,
      delay:    `${(i * 4.5 + Math.random() * 3).toFixed(2)}s`,
      duration: `${(9 + Math.random() * 9).toFixed(2)}s`,
    })), []);

  return (
    <div className="star-bg">
      {/* Ambient glow overlays */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(56,189,248,0.075) 0%, transparent 62%)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 55% 45% at 92% 85%, rgba(129,140,248,0.055) 0%, transparent 52%)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 40% 40% at 5% 20%, rgba(56,189,248,0.04) 0%, transparent 50%)",
      }} />

      {/* Stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          className="star"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            animationName: "twinkle",
            animationDuration: s.duration,
            animationDelay: s.delay,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
          }}
        />
      ))}

      {/* Satellite streaks */}
      {streaks.map((s) => (
        <div
          key={s.id}
          className="satellite-streak"
          style={{
            top: s.top,
            width: s.width,
            animationDuration: s.duration,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}
