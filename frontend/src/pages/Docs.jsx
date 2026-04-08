import { useState } from "react";
import { Link } from "react-router-dom";

const BASE = (import.meta.env.VITE_API_URL ?? "https://virenn77-spacedebrisai.hf.space").replace(/\/+$/, "");
const PUBLIC_OBJECT_LIMIT = 500;
const CACHED_TLE_RECORDS = "90k+";
const MIN_POLLING = "10 sec";

const SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    content: null,
  },
  {
    id: "authentication",
    label: "Authentication",
    content: null,
  },
  {
    id: "endpoints",
    label: "Endpoints",
    children: [
      { id: "ep-health", label: "GET /health" },
      { id: "ep-sats", label: "GET /satellites" },
      { id: "ep-simulate", label: "GET /simulate" },
      { id: "ep-sim-high-risk", label: "GET /simulate/high-risk" },
      { id: "ep-sim-stats", label: "GET /simulate/stats" },
      { id: "ep-tracker", label: "GET /tracker/positions" },
      { id: "ep-cdm", label: "GET /cdm" },
      { id: "ep-odri", label: "GET /risk/odri" },
      { id: "ep-cascade", label: "POST /cascade/ask" },
    ],
  },
  {
    id: "errors",
    label: "Error handling",
    content: null,
  },
  {
    id: "models",
    label: "Data models",
    content: null,
  },
  {
    id: "rate-limits",
    label: "Rate limits",
    content: null,
  },
];

function Pill({ text, color = "var(--accent)" }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.05em",
      background: color + "22",
      color,
      border: `1px solid ${color}44`,
    }}>{text}</span>
  );
}

function Code({ children, lang = "http", copyable = true }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="docs-code-wrap">
      {lang && <span className="docs-code-lang">{lang}</span>}
      {copyable && (
        <button
          className="docs-code-copy"
          onClick={() => {
            navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
      <pre className="docs-pre">{children}</pre>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section className="docs-section" id={id}>
      <h2 className="docs-section-title">{title}</h2>
      {children}
    </section>
  );
}

function Endpoint({ id, method, path, badge, auth, desc, params, response, example }) {
  const cls = { GET: "docs-ep-get", POST: "docs-ep-post", DELETE: "docs-ep-del" };
  return (
    <div className={`docs-endpoint ${cls[method] ?? ""}`} id={id ?? `ep-${path.replace(/\//g, "-").slice(1)}`}>
      <div className="docs-ep-header">
        <span className="docs-ep-method">{method}</span>
        <code className="docs-ep-path">{path}</code>
        {auth && <Pill text="Auth required" color="#f59e0b" />}
        {badge && <Pill text={badge} />}
      </div>
      <p className="docs-ep-desc">{desc}</p>

      {params && params.length > 0 && (
        <>
          <h4 className="docs-ep-sub">Query parameters</h4>
          <table className="docs-table">
            <thead>
              <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
            </thead>
            <tbody>
              {params.map((p) => (
                <tr key={p.name}>
                  <td><code className="ap-inline-code">{p.name}</code></td>
                  <td><span className="docs-type">{p.type}</span></td>
                  <td>{p.required ? <Pill text="Required" color="#f87171" /> : <Pill text="Optional" color="#6b7280" />}</td>
                  <td>{p.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {example && (
        <>
          <h4 className="docs-ep-sub">Example request</h4>
          <Code lang="bash">{example}</Code>
        </>
      )}

      {response && (
        <>
          <h4 className="docs-ep-sub">Response</h4>
          <Code lang="json">{JSON.stringify(response, null, 2)}</Code>
        </>
      )}
    </div>
  );
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState("overview");

  const nav = (id) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="docs-root">
      <aside className="docs-sidebar">
        <div className="docs-sidebar-inner">
          <p className="docs-sidebar-title">API Reference</p>
          <nav className="docs-nav">
            {SECTIONS.map((s) => (
              <div key={s.id}>
                <button
                  className={`docs-nav-item${activeSection === s.id ? " active" : ""}`}
                  onClick={() => nav(s.id)}
                >
                  {s.label}
                </button>
                {s.children && s.children.map((c) => (
                  <button
                    key={c.id}
                    className={`docs-nav-child${activeSection === c.id ? " active" : ""}`}
                    onClick={() => nav(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="docs-sidebar-links">
            <a href={`${BASE}/docs`} target="_blank" rel="noopener noreferrer" className="docs-sidebar-ext">
              Swagger UI
            </a>
            <Link to="/api" className="docs-sidebar-ext">API keys</Link>
          </div>
        </div>
      </aside>

      <main className="docs-main">
        <div className="docs-page-header">
          <p className="docs-eyebrow">Documentation</p>
          <h1 className="docs-h1">SpaceDebrisAI API</h1>
          <p className="docs-h1-sub">
            REST API for real-time orbital tracking, proximity risk classification,
            AI-powered avoidance maneuver recommendations, live ODRI scoring,
            and cascade intelligence answers grounded in the current risk snapshot.
            Built on SGP4 propagation over a public {PUBLIC_OBJECT_LIMIT}-object slice backed by a 33k+ hourly-refreshed KeepTrack cache.
          </p>
          <div className="docs-header-pills">
            <Pill text="v2.0" />
            <Pill text={`${PUBLIC_OBJECT_LIMIT} public objects`} color="#4ade80" />
            <Pill text={`${CACHED_TLE_RECORDS} TLE records`} color="#f59e0b" />
            <Pill text="SGP4" color="#818cf8" />
            <Pill text={`${MIN_POLLING} min polling`} color="#22c55e" />
          </div>
        </div>

        <Section id="overview" title="Overview">
          <p className="docs-p">
            SpaceDebrisAI provides a JSON REST API for monitoring the current public
            {PUBLIC_OBJECT_LIMIT}-object slice of tracked satellites and debris. The backend computes
            real-time positions using SGP4/SDP4 orbital propagation and now keeps a
            larger 33k+ local TLE catalog refreshed from KeepTrack once per hour for broader coverage.
          </p>
          <div className="docs-callout">
            <strong>Base URL</strong>
            <Code lang="http" copyable>{BASE}</Code>
          </div>
          <h3 className="docs-h3">Quick start</h3>
          <Code lang="bash">{`# 1. Create a free or guest key on the /api page

# 2. Health check (no auth required)
curl ${BASE}/health

# 3. First request - public ${PUBLIC_OBJECT_LIMIT}-object snapshot
curl -H "X-API-Key: YOUR_KEY" ${BASE}/satellites | jq '.satellites[0]'`}</Code>
        </Section>

        <Section id="authentication" title="Authentication">
          <p className="docs-p">
            Programmatic access should send an API key on every request except{" "}
            <code className="ap-inline-code">/health</code> and <code className="ap-inline-code">/docs</code>.
            Public read endpoints now retry anonymously in the web client if the browser is holding a stale key.
            Pass it as a request header:
          </p>
          <Code lang="http">{`X-API-Key: sdai_xxxxxxxxxxxxxxxxxxxxxxxx_live`}</Code>
          <p className="docs-p">
            Generate a backend-issued account key or a browser-only guest key on the{" "}
            <Link to="/api" className="docs-link">API keys page</Link>.
            You must accept the polling terms before a key is issued.
          </p>

          <h3 className="docs-h3">Authentication errors</h3>
          <table className="docs-table">
            <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code className="ap-inline-code">401</code></td><td>Missing or invalid <code className="ap-inline-code">X-API-Key</code> header</td></tr>
              <tr><td><code className="ap-inline-code">429</code></td><td>Fair-use limit exceeded or polling too quickly</td></tr>
              <tr><td><code className="ap-inline-code">403</code></td><td>API key banned, inactive, or blocked by fair-use enforcement</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="endpoints" title="Endpoints">
          <Endpoint
            id="ep-health"
            method="GET"
            path="/health"
            badge="No auth"
            auth={false}
            desc="Returns 200 OK when the backend is online. Use this to check service availability before making data requests."
            params={[]}
            response={{ status: "ok", version: "2.0.0", uptime_s: 3824 }}
            example={`curl ${BASE}/health`}
          />

          <Endpoint
            id="ep-sats"
            method="GET"
            path="/satellites"
            auth
            desc="Returns real-time geodetic positions (latitude, longitude, altitude in km) for the current public slice, computed via SGP4 propagation from the local 33k+ TLE catalog. Also includes raw TLE lines for your own propagation."
            params={[]}
            response={{
              count: 414,
              errors: 0,
              timestamp: "2026-03-11T10:00:00.000Z",
              satellites: [
                {
                  name: "THOR ABLESTAR DEB",
                  lat: 24.18,
                  lon: 109.33,
                  alt_km: 455.8,
                  tle_line1: "1 00694U 63047A   26070.89344144 -.00000083  00000-0 -12332-3 0  9994",
                  tle_line2: "2 00694  30.3585 254.9786 0621246 131.7077 233.9575 13.43887564929859",
                },
              ],
            }}
            example={`curl -H "X-API-Key: YOUR_KEY" ${BASE}/satellites | jq '.satellites[:3]'`}
          />

          <Endpoint
            id="ep-simulate"
            method="GET"
            path="/simulate"
            auth
            desc={`Runs a proximity simulation across the current ${PUBLIC_OBJECT_LIMIT}-object public slice. Returns positions, the 20 closest approach pairs sorted by separation distance, AI risk classifications, and recommended avoidance maneuvers. Results are served from a short-lived backend cache built from the local TLE catalog.`}
            params={[]}
            response={{
              mode: "local",
              meta: { satellites: 487, public_objects: 500, tle_records: 33338, tle_source: "cache", pairs_checked: 118341, processing_ms: 742.6 },
              satellites: [{ name: "THOR ABLESTAR DEB", lat: 24.18, lon: 109.33, alt_km: 455.8 }],
              closest_pairs: [
                {
                  satellites: ["THOR ABLESTAR DEB", "SL-8 DEB"],
                  before: { distance_km: 3.12, risk: { level: "CRITICAL", score: 0.97 } },
                  after: { distance_km: 28.4, risk: { level: "LOW", score: 0.12 } },
                  maneuver: "Raise apogee by 500 m",
                },
              ],
              timestamp_utc: "2026-03-11T10:00:00.000Z",
            }}
            example={`curl -H "X-API-Key: YOUR_KEY" ${BASE}/simulate | jq '{mode,meta}'`}
          />

          <Endpoint
            id="ep-sim-high-risk"
            method="GET"
            path="/simulate/high-risk"
            badge="New"
            auth
            desc="Returns high-risk collision events filtered by risk level (CRITICAL, HIGH, or MEDIUM). Each event includes miss distance, relative velocity, probability of collision, and recommended maneuver."
            params={[
              { name: "threshold", type: "string", required: false, desc: "Risk threshold filter: CRITICAL, HIGH, or MEDIUM (default: HIGH)" },
            ]}
            response={{
              threshold: "HIGH",
              count: 5,
              high_risk_collisions: [
                {
                  satellites: ["STARLINK-1234", "STARLINK-5678"],
                  norad_ids: [44713, 44714],
                  miss_distance_km: 2.34,
                  probability_of_collision: 1.23e-5,
                  relative_velocity_km_s: 0.542,
                  risk_level: "HIGH",
                  risk_score: 82,
                  maneuver: "Altitude boost +15 km — execute within 3 orbits",
                  tca_time: "2026-03-11T14:23:45.000Z",
                },
              ],
              timestamp_utc: "2026-03-11T10:00:00.000Z",
            }}
            example={`curl -H "X-API-Key: YOUR_KEY" "${BASE}/simulate/high-risk?threshold=HIGH" | jq '.count'`}
          />

          <Endpoint
            id="ep-sim-stats"
            method="GET"
            path="/simulate/stats"
            badge="New"
            auth
            desc="Returns simulation statistics including satellites screened, catalog changes, risk distribution, and processing metrics. Useful for monitoring system performance and catalog health."
            params={[]}
            response={{
              satellites_screened: 2000,
              total_catalog_records: 33338,
              pairs_checked: 118341,
              processing_ms: 742.6,
              tle_source: "cache",
              catalog_changes: { added: 12, removed: 3 },
              risk_distribution: { CRITICAL: 2, HIGH: 8, MEDIUM: 15, LOW: 195 },
              timestamp_utc: "2026-03-11T10:00:00.000Z",
            }}
            example={`curl -H "X-API-Key: YOUR_KEY" "${BASE}/simulate/stats" | jq '.risk_distribution'`}
          />

          <Endpoint
            id="ep-tracker"
            method="GET"
            path="/tracker/positions"
            auth
            desc="Fetches propagated positions for the current tracker slice directly from the local TLE cache. No browser request to this endpoint calls KeepTrack or any other external provider."
            params={[]}
            response={{
              source: "cache",
              cached_at: "2026-03-11 10:05:35",
              satellites: [
                {
                  noradId: 25544,
                  name: "ISS (ZARYA)",
                  lat: 51.62,
                  lon: -12.4,
                  alt: 408.5,
                  azimuth: 220.3,
                  elevation: 34.1,
                  timestamp: 1741689600,
                },
              ],
            }}
            example={`curl -H "X-API-Key: YOUR_KEY" ${BASE}/tracker/positions | jq '.satellites[0]'`}
          />

          <Endpoint
            id="ep-cdm"
            method="GET"
            path="/cdm"
            auth
            desc="Returns Conjunction Data Messages (CDMs) from Space-Track.org. Each CDM contains detailed proximity data including time of closest approach, miss distance, probability of collision, and relative velocity between objects."
            params={[
              { name: "refresh", type: "boolean", required: false, desc: "Force a fresh fetch from Space-Track (may be rate-limited)" },
            ]}
            response={{
              count: 5,
              refreshed_at: "2026-03-11T10:05:35Z",
              source: "space-track",
              cdms: [
                {
                  cdm_id: "2026-001A-018",
                  satellites: ["COSMOS-2251 DEB", "SL-8 DEB"],
                  tca_time: "2026-03-11T14:23:45Z",
                  miss_distance_km: 0.582,
                  relative_speed_km_s: 11.45,
                  probability_of_collision: 2.34e-7,
                  pc_scientific: "2.34e-07",
                  confidence: "LOW",
                  collision_risk: "LOW",
                },
              ],
            }}
            example={`curl -H "X-API-Key: YOUR_KEY" ${BASE}/cdm | jq '.cdms[0]'`}
          />

          <Endpoint
            id="ep-odri"
            method="GET"
            path="/risk/odri"
            auth
            desc="Returns the live Orbital Debris Risk Index snapshot. Without query parameters it returns the top-risk objects plus a 30-day projection timeline. With sat_id it returns a single-object breakdown including sigma, omega, psi, phi, and projected ODRI."
            params={[
              { name: "sat_id", type: "string", required: false, desc: "NORAD id or object name to resolve a single ODRI record" },
              { name: "delta_t", type: "number", required: false, desc: "Projection horizon in days for single-object lookups (default 7)" },
              { name: "limit", type: "integer", required: false, desc: "Number of top-risk objects to return when sat_id is omitted (default 10)" },
            ]}
            response={{
              items: [
                {
                  sat_id: "01575",
                  object_name: "SL-8 R/B",
                  odri: 0.0016,
                  projected_odri: 0.0021,
                  risk_level: "NOMINAL",
                  components: {
                    sigma_collision: 0.6718,
                    omega_cascade: 0.0048,
                    psi_temporal: 0.5062,
                    phi_maneuver: 1.0,
                  },
                },
              ],
              summary: {
                tracked_count: 320,
                average_odri: 0.0004,
                average_shell_density: 1.3e-9,
                active_conjunction_warnings: 4,
              },
              timeline: [
                { date: "2026-03-23", projected_odri: 0.0005, critical_threshold: 0.85, risk_level: "NOMINAL" },
              ],
            }}
            example={`curl -H "X-API-Key: YOUR_KEY" "${BASE}/risk/odri?limit=5" | jq '.items[0]'`}
          />

          <Endpoint
            id="ep-cascade"
            method="POST"
            path="/cascade/ask"
            auth
            desc="Returns a natural-language cascade assessment grounded in the live ODRI snapshot, shell density, and active conjunction warnings. The backend uses Groq when configured and falls back to a deterministic summary when no model key is present."
            params={[]}
            response={{
              answer: "### Cascade Assessment\nThe current snapshot shows...",
              risk_relevance: 0.72,
              affected_systems: ["GPS", "ISS"],
              cascade_threat_level: "NOMINAL",
              odri_snapshot: {
                summary: { average_odri: 0.0004, active_conjunction_warnings: 4 },
                top_objects: [{ sat_id: "01575", object_name: "SL-8 R/B", odri: 0.0016 }],
              },
            }}
            example={`curl -X POST "${BASE}/cascade/ask" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_KEY" \\
  -d '{"question":"How does solar activity worsen debris cascading?","context":{"include_live_odri":true,"sat_ids":[]}}'`}
          />
        </Section>

        <Section id="errors" title="Error handling">
          <p className="docs-p">
            All error responses return JSON with a <code className="ap-inline-code">detail</code> field.
          </p>
          <Code lang="json">{`{
  "detail": "Failed to propagate TLE for satellite COSMOS-2251 DEB"
}`}</Code>
          <table className="docs-table">
            <thead><tr><th>HTTP status</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td><code className="ap-inline-code">200</code></td><td>Success</td></tr>
              <tr><td><code className="ap-inline-code">401</code></td><td>Unauthorized - check your <code className="ap-inline-code">X-API-Key</code></td></tr>
              <tr><td><code className="ap-inline-code">403</code></td><td>Forbidden - banned key, blocked client, or inactive key</td></tr>
              <tr><td><code className="ap-inline-code">422</code></td><td>Validation error - invalid query parameters</td></tr>
              <tr><td><code className="ap-inline-code">429</code></td><td>Too many requests - rate limit exceeded, includes a <code className="ap-inline-code">Retry-After</code> header</td></tr>
              <tr><td><code className="ap-inline-code">500</code></td><td>Server error - TLE propagation failed or backend unavailable</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="models" title="Data models">
          <h3 className="docs-h3">Satellite position</h3>
          <table className="docs-table">
            <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code className="ap-inline-code">name</code></td><td>string</td><td>Object name from the TLE catalog</td></tr>
              <tr><td><code className="ap-inline-code">lat</code></td><td>number</td><td>Geodetic latitude in degrees (-90 to 90)</td></tr>
              <tr><td><code className="ap-inline-code">lon</code></td><td>number</td><td>Geodetic longitude in degrees (-180 to 180)</td></tr>
              <tr><td><code className="ap-inline-code">alt_km</code></td><td>number</td><td>Altitude above WGS-84 ellipsoid in km</td></tr>
              <tr><td><code className="ap-inline-code">tle_line1</code></td><td>string</td><td>TLE line 1 (69 chars)</td></tr>
              <tr><td><code className="ap-inline-code">tle_line2</code></td><td>string</td><td>TLE line 2 (69 chars)</td></tr>
            </tbody>
          </table>

          <h3 className="docs-h3">Conjunction pair</h3>
          <table className="docs-table">
            <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code className="ap-inline-code">satellites</code></td><td>string[2]</td><td>Names of the two objects</td></tr>
              <tr><td><code className="ap-inline-code">before.distance_km</code></td><td>number</td><td>Current separation in km</td></tr>
              <tr><td><code className="ap-inline-code">before.risk.level</code></td><td>string</td><td>CRITICAL, MEDIUM, or LOW</td></tr>
              <tr><td><code className="ap-inline-code">before.risk.score</code></td><td>number</td><td>Risk score 0-100</td></tr>
              <tr><td><code className="ap-inline-code">after.distance_km</code></td><td>number</td><td>Distance after maneuver</td></tr>
              <tr><td><code className="ap-inline-code">maneuver</code></td><td>string</td><td>AI-recommended avoidance action</td></tr>
            </tbody>
          </table>

          <h3 className="docs-h3">ODRI object</h3>
          <table className="docs-table">
            <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code className="ap-inline-code">sat_id</code></td><td>string</td><td>NORAD id or derived object id</td></tr>
              <tr><td><code className="ap-inline-code">odri</code></td><td>number</td><td>Current orbital debris risk index score</td></tr>
              <tr><td><code className="ap-inline-code">projected_odri</code></td><td>number</td><td>Forward projected ODRI score</td></tr>
              <tr><td><code className="ap-inline-code">components.sigma_collision</code></td><td>number</td><td>Collision susceptibility term</td></tr>
              <tr><td><code className="ap-inline-code">components.omega_cascade</code></td><td>number</td><td>Shell cascade amplification term</td></tr>
              <tr><td><code className="ap-inline-code">components.psi_temporal</code></td><td>number</td><td>Time-to-approach urgency term</td></tr>
              <tr><td><code className="ap-inline-code">components.phi_maneuver</code></td><td>number</td><td>Maneuver resilience term</td></tr>
              <tr><td><code className="ap-inline-code">risk_level</code></td><td>string</td><td>NOMINAL, ELEVATED, ADVISORY, WARNING, or CRITICAL</td></tr>
            </tbody>
          </table>

          <h3 className="docs-h3">Risk levels</h3>
          <table className="docs-table">
            <thead><tr><th>Level</th><th>Distance</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td><Pill text="CRITICAL" color="#f87171" /></td><td>&lt; 5 km</td><td>Immediate avoidance maneuver required</td></tr>
              <tr><td><Pill text="MEDIUM" color="#fcd34d" /></td><td>5 - 50 km</td><td>Monitor closely, prepare contingency</td></tr>
              <tr><td><Pill text="LOW" color="#4ade80" /></td><td>&gt; 50 km</td><td>Nominal - no action needed</td></tr>
            </tbody>
          </table>
        </Section>

        <Section id="rate-limits" title="Rate limits">
          <div className="docs-limits-grid">
            <div className="docs-limit-card">
              <div className="docs-limit-val">60</div>
              <div className="docs-limit-label">requests / minute</div>
            </div>
            <div className="docs-limit-card">
              <div className="docs-limit-val">{PUBLIC_OBJECT_LIMIT}</div>
              <div className="docs-limit-label">public objects</div>
            </div>
            <div className="docs-limit-card">
              <div className="docs-limit-val">{CACHED_TLE_RECORDS}</div>
              <div className="docs-limit-label">cached TLE records</div>
            </div>
            <div className="docs-limit-card">
              <div className="docs-limit-val">{MIN_POLLING}</div>
              <div className="docs-limit-label">minimum polling interval</div>
            </div>
            <div className="docs-limit-card">
              <div className="docs-limit-val">3</div>
              <div className="docs-limit-label">violations before ban</div>
            </div>
          </div>
          <p className="docs-p" style={{ marginTop: "1.5rem" }}>
            This is still a research and demonstration API. Public access currently exposes
            the 2000-object slice. Authenticated traffic is monitored against the published polling terms,
            repeated violations return <code className="ap-inline-code">429</code> first with <code className="ap-inline-code">Retry-After</code>,
            and recent repeat offenders are then banned with <code className="ap-inline-code">403</code>.
            Deployment owners can exempt trusted IPs, emails, or API keys with the backend
            <code className="ap-inline-code"> RATE_LIMIT_EXEMPT_*</code> environment variables.
          </p>
        </Section>
      </main>
    </div>
  );
}
