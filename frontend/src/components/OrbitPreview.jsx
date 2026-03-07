export default function OrbitPreview({ distance }) {
  const scale = Math.min(distance / 100, 120);

  return (
    <div
      style={{
        marginTop: "24px",
        height: "140px",
        position: "relative",
        borderRadius: "12px",
        background: "#020617",
        border: "1px solid rgba(148,163,184,0.1)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: "#38bdf8",
          transform: "translate(-50%, -50%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${scale}px`,
          height: `${scale}px`,
          borderRadius: "50%",
          border: "1px dashed rgba(148,163,184,0.4)",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}
