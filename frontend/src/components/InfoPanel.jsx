export default function InfoPanel() {
  return (
    <div style={panel}>
      <h3 style={heading}>Simulation Context</h3>

      <ul style={list}>
        <li>Data Source: CelesTrak (cached TLEs)</li>
        <li>Orbit Model: SGP4</li>
        <li>Screening: Multi-satellite</li>
        <li>Mode: Live Conjunction Scan</li>
      </ul>

      <p style={footer}>
        Auto-updated on refresh
      </p>
    </div>
  );
}

const panel = {
  background: "rgba(2, 6, 23, 0.9)",
  borderRadius: "18px",
  padding: "28px",
  boxShadow: "0 0 40px rgba(0,0,0,0.6)",
};

const heading = {
  marginBottom: "16px",
  fontSize: "1.1rem",
};

const list = {
  listStyle: "none",
  padding: 0,
  lineHeight: 1.8,
  opacity: 0.85,
};

const footer = {
  marginTop: "20px",
  fontSize: "0.85rem",
  opacity: 0.6,
};
