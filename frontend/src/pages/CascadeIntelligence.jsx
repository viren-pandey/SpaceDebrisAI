import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CascadeMarkdown from "../components/cascade/CascadeMarkdown";
import CascadeRiskCards from "../components/cascade/CascadeRiskCards";
import CascadeTimeline from "../components/cascade/CascadeTimeline";
import CascadeErrorBoundary from "../components/cascade/CascadeErrorBoundary";
import {
  askCascadeQuestion,
  fetchOdriSnapshot,
  fetchSatellites,
  fetchSimulationAuthed,
} from "../api/backend";

const CRITICAL_THRESHOLD = 0.85;
const REFRESH_INTERVAL_MS = 60_000;
const STAGGER_MS = 1_100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTime(value) {
  if (!value) return "Pending";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function averageOf(items, selector) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + selector(item), 0) / items.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNoradFromTle(line1) {
  if (!line1 || line1.length < 7) return "";
  return line1.slice(2, 7).trim();
}

function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getRiskLevel(score) {
  if (score >= 0.85) return "CRITICAL";
  if (score >= 0.65) return "WARNING";
  if (score >= 0.45) return "ADVISORY";
  if (score >= 0.25) return "ELEVATED";
  return "NOMINAL";
}

function simulationRiskToOdri(simulation) {
  const pairs = simulation?.closest_pairs ?? [];
  if (!pairs.length) return 0;
  return averageOf(pairs.slice(0, 10), (pair) => ((pair.before?.risk?.score ?? 0) / 100) * 0.9);
}

function buildStats(satellitesPayload, simulationPayload, snapshot) {
  const satellites = satellitesPayload?.satellites ?? [];
  const items = snapshot?.items ?? [];
  const snapshotAverage = snapshot?.summary?.average_odri;
  const averageOdri = snapshotAverage ?? (
    items.length
      ? averageOf(items, (item) => item.odri ?? 0)
      : simulationRiskToOdri(simulationPayload)
  );
  const warningCount = items.length
    ? items.filter((item) => (item.odri ?? 0) > 0.7).length
    : (simulationPayload?.closest_pairs ?? []).filter((pair) => (pair.before?.risk?.score ?? 0) >= 70).length;

  return {
    trackedObjects: satellites.length,
    averageOdri: Number.isFinite(averageOdri) ? averageOdri : 0,
    activeWarnings: warningCount,
  };
}

function buildLeaders(satellitesPayload, snapshot) {
  const satellites = satellitesPayload?.satellites ?? [];
  const satByName = new Map(satellites.map((sat) => [normalizeName(sat.name), sat]));
  const satByNorad = new Map(satellites.map((sat) => [parseNoradFromTle(sat.tle_line1), sat]));

  return (snapshot?.items ?? [])
    .slice()
    .sort((left, right) => (right.odri ?? 0) - (left.odri ?? 0))
    .slice(0, 5)
    .map((item) => {
      const liveSat = satByNorad.get(String(item.norad_id ?? item.sat_id ?? ""))
        ?? satByName.get(normalizeName(item.object_name));
      return {
        satId: item.sat_id,
        objectName: item.object_name,
        noradId: item.norad_id ?? item.sat_id,
        altitudeKm: liveSat?.alt_km ?? item.inputs?.altitude_km ?? null,
        odri: item.odri ?? 0,
        projectedOdri: item.projected_odri ?? item.odri ?? 0,
        riskLevel: item.projected_risk_level ?? item.risk_level ?? getRiskLevel(item.odri ?? 0),
        trend: item.trend ?? "stable",
      };
    });
}

function buildTimeline(snapshot, baseAverage) {
  const timeline = snapshot?.timeline ?? [];
  if (timeline.length) {
    return timeline.map((point) => ({
      date: point.date,
      projected_odri: point.projected_odri,
      critical_threshold: point.critical_threshold ?? CRITICAL_THRESHOLD,
      risk_level: point.risk_level ?? getRiskLevel(point.projected_odri),
    }));
  }

  const today = new Date();
  return Array.from({ length: 31 }, (_, index) => {
    const next = new Date(today);
    next.setDate(today.getDate() + index);
    const projected = baseAverage * Math.exp(0.003 * index);
    return {
      date: next.toISOString().slice(0, 10),
      projected_odri: projected,
      critical_threshold: CRITICAL_THRESHOLD,
      risk_level: getRiskLevel(projected),
    };
  });
}

function buildDomainCards(satellitesPayload, simulationPayload, snapshot, stats) {
  const satellites = satellitesPayload?.satellites ?? [];
  const items = snapshot?.items ?? [];
  const summary = snapshot?.summary ?? {};
  const updatedAt = formatTime(summary.updated_at ?? satellitesPayload?.timestamp ?? simulationPayload?.timestamp_utc);
  const trackedObjects = Math.max(stats.trackedObjects, 1);
  const averageScore = stats.averageOdri;
  const projectedAverage = averageOf(items, (item) => item.projected_odri ?? item.odri ?? 0);
  const warnings = stats.activeWarnings;
  const shellDensity = summary.average_shell_density ?? 0;

  const commBand = satellites.filter((sat) => (sat.alt_km ?? 0) >= 550 && (sat.alt_km ?? 0) <= 1200);
  const leoConstellations = items.filter((item) => {
    const name = normalizeName(item.object_name);
    return (name.includes("starlink") || name.includes("oneweb")) && (item.odri ?? 0) > 0.5;
  });
  const gpsDrift = Math.max(0.4, averageScore * 1200 + shellDensity * 4e9);
  const blockedTrajectories = (simulationPayload?.closest_pairs ?? []).filter((pair) => {
    const riskScore = pair.before?.risk?.score ?? 0;
    return riskScore >= 70 || (pair.before?.distance_km ?? Infinity) < 50;
  }).length;
  const issConjunctions = satellites.filter((sat) => Math.abs((sat.alt_km ?? 0) - 408) <= 10).length;
  const solarOcclusions = Math.max(1, Math.round(shellDensity * 1.5e10 + trackedObjects * 0.012));

  return {
    satcom: {
      score: clamp(commBand.length / trackedObjects + averageScore * 0.6, 0, 1),
      projectedScore: clamp(projectedAverage * 0.9 + commBand.length / trackedObjects, 0, 1),
      value: `${commBand.length} objects in 550-1200 km`,
      caption: "Communications shells are derived from live altitude bands in the cached satellite catalog.",
      updatedAt,
    },
    internet: {
      score: clamp(leoConstellations.length / Math.max(items.length, 1) + averageScore * 0.7, 0, 1),
      projectedScore: clamp(averageOf(leoConstellations, (item) => item.projected_odri ?? item.odri ?? 0) || averageScore, 0, 1),
      value: `${leoConstellations.length} constellation objects above 0.5 ODRI`,
      caption: "Starlink and OneWeb exposure is grounded in current high-risk ODRI objects rather than placeholder percentages.",
      updatedAt,
    },
    gps: {
      score: clamp(averageScore * 0.9 + shellDensity * 3e7, 0, 1),
      projectedScore: clamp(projectedAverage * 0.85 + shellDensity * 3.4e7, 0, 1),
      value: `+${gpsDrift.toFixed(2)} m drift estimate`,
      caption: "The drift estimate increases with shell congestion and current average ODRI pressure.",
      updatedAt,
    },
    launch: {
      score: clamp(blockedTrajectories / 12 + averageScore * 0.65, 0, 1),
      projectedScore: clamp((blockedTrajectories + warnings) / 12 + projectedAverage * 0.55, 0, 1),
      value: `${blockedTrajectories} blocked trajectories`,
      caption: "Launch window pressure uses conjunction screening results from the live simulation feed.",
      updatedAt,
    },
    iss: {
      score: clamp(issConjunctions / 20 + averageScore * 0.7, 0, 1),
      projectedScore: clamp(issConjunctions / 20 + projectedAverage * 0.65, 0, 1),
      value: `${Math.max(issConjunctions - 1, 0)} objects within 10 km of ISS altitude`,
      caption: "ISS proximity is computed from live altitude clustering around the station shell at 408 km.",
      updatedAt,
    },
    solar: {
      score: clamp(shellDensity * 4e7 + averageScore * 0.8, 0, 1),
      projectedScore: clamp(shellDensity * 4.6e7 + projectedAverage * 0.82, 0, 1),
      value: `${solarOcclusions} occlusion events / week`,
      caption: "Solar observation disruption is inferred from current debris density and projected cascade growth.",
      updatedAt,
    },
  };
}

function buildFocusSatIds(leaders) {
  return leaders.slice(0, 3).map((leader) => leader.satId).filter(Boolean);
}

function LeaderSkeleton() {
  return (
    <div className="ci-object-card ci-skeleton-card">
      <div className="ci-skeleton-block ci-skeleton-title" />
      <div className="ci-skeleton-block ci-skeleton-metric" />
    </div>
  );
}

function CascadeIntelligenceContent() {
  const [satellitesPayload, setSatellitesPayload] = useState(null);
  const [simulationPayload, setSimulationPayload] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const refreshSeqRef = useRef(0);

  const stats = useMemo(
    () => buildStats(satellitesPayload, simulationPayload, snapshot),
    [satellitesPayload, simulationPayload, snapshot]
  );
  const leaders = useMemo(
    () => buildLeaders(satellitesPayload, snapshot),
    [satellitesPayload, snapshot]
  );
  const cards = useMemo(
    () => buildDomainCards(satellitesPayload, simulationPayload, snapshot, stats),
    [satellitesPayload, simulationPayload, snapshot, stats]
  );
  const timeline = useMemo(
    () => buildTimeline(snapshot, stats.averageOdri),
    [snapshot, stats.averageOdri]
  );
  const updatedAt = snapshot?.summary?.updated_at ?? satellitesPayload?.timestamp ?? simulationPayload?.timestamp_utc;

  const loadAllData = useCallback(async ({ initial = false } = {}) => {
    const requestId = refreshSeqRef.current + 1;
    refreshSeqRef.current = requestId;
    if (initial) setLoading(true);
    setRefreshing(true);
    setError(null);

    let nextError = null;

    try {
      const satellites = await fetchSatellites();
      if (refreshSeqRef.current !== requestId) return;
      setSatellitesPayload(satellites);
    } catch (err) {
      nextError = err.message;
    }

    await sleep(STAGGER_MS);
    if (refreshSeqRef.current !== requestId) return;

    try {
      const simulation = await fetchSimulationAuthed();
      if (refreshSeqRef.current !== requestId) return;
      setSimulationPayload(simulation);
    } catch (err) {
      nextError = nextError ?? err.message;
    }

    await sleep(STAGGER_MS);
    if (refreshSeqRef.current !== requestId) return;

    try {
      const nextSnapshot = await fetchOdriSnapshot(25);
      if (refreshSeqRef.current !== requestId) return;
      setSnapshot(nextSnapshot);
    } catch (err) {
      nextError = nextError ?? err.message;
    }

    if (refreshSeqRef.current === requestId) {
      setError(nextError);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      loadAllData({ initial: true });
    }
    const interval = setInterval(() => {
      if (!mounted) return;
      loadAllData();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
      refreshSeqRef.current += 1;
    };
  }, [loadAllData]);

  const submitQuestion = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const messageId = Date.now();
    setQuestion("");
    setAsking(true);
    setError(null);
    setChatHistory((history) => [
      ...history,
      { id: `u-${messageId}`, role: "user", content: trimmed },
      { id: `a-${messageId}`, role: "assistant", content: "", loading: true, systems: [], threatLevel: "ANALYZING" },
    ]);

    try {
      const data = await askCascadeQuestion({
        question: trimmed,
        context: {
          include_live_odri: true,
          sat_ids: buildFocusSatIds(leaders),
        },
      });
      setChatHistory((history) =>
        history.map((entry) =>
          entry.id === `a-${messageId}`
            ? {
                ...entry,
                loading: false,
                content: data.answer,
                systems: data.affected_systems ?? [],
                threatLevel: data.cascade_threat_level ?? "NOMINAL",
                riskRelevance: data.risk_relevance ?? 0,
              }
            : entry
        )
      );
    } catch (err) {
      setError(err.message);
      setChatHistory((history) =>
        history.map((entry) =>
          entry.id === `a-${messageId}`
            ? {
                ...entry,
                loading: false,
                content: "The cascade analysis service is unavailable right now. Refresh the page and try again.",
                systems: [],
                threatLevel: "UNAVAILABLE",
                riskRelevance: 0,
              }
            : entry
        )
      );
    } finally {
      setAsking(false);
    }
  }, [leaders, question]);

  return (
    <div className="ci-page ci-page--enter">
      <section className="page-hero ci-hero">
        <div className="ci-hero-top">
          <div>
            <p className="page-hero-eyebrow">Live ODRI Snapshot | Cascade Analysis | Earth Impact View</p>
            <h1 className="page-hero-title">
              Cascade
              <br />
              <span style={{ color: "var(--accent)" }}>Intelligence</span>
            </h1>
            <p className="page-hero-sub">
              Ask how orbital debris affects life on Earth, grounded in live ODRI scores, shell density, and conjunction pressure.
            </p>
          </div>

          <button type="button" className="ci-refresh" onClick={() => loadAllData()} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="ci-hero-stats">
          <div className={`ci-stat${loading ? " ci-stat--loading" : ""}`}>
            <span className="ci-stat-value">{loading && !satellitesPayload ? "..." : stats.trackedObjects.toLocaleString()}</span>
            <span className="ci-stat-label">tracked objects</span>
          </div>
          <div className={`ci-stat${loading ? " ci-stat--loading" : ""}`}>
            <span className="ci-stat-value">{loading && !snapshot ? "..." : stats.averageOdri.toFixed(3)}</span>
            <span className="ci-stat-label">average ODRI</span>
          </div>
          <div className={`ci-stat${loading ? " ci-stat--loading" : ""}`}>
            <span className="ci-stat-value">{loading && !snapshot ? "..." : stats.activeWarnings}</span>
            <span className="ci-stat-label">active warnings</span>
          </div>
        </div>

        <div className="ci-hero-foot">
          <span className="ci-updated">Updated {formatTime(updatedAt)}</span>
          {error ? <span className="ci-fallback-banner">{error}</span> : null}
        </div>
      </section>

      <section className="ci-shell">
        <aside className="ci-side ci-side--left">
          <div className="ci-panel">
            <div className="ci-panel-head">
              <div>
                <p className="ci-kicker">Highest Risk Objects</p>
                <h2 className="ci-title">Current Leaders</h2>
              </div>
            </div>
            <div className="ci-object-list">
              {loading && !leaders.length
                ? Array.from({ length: 5 }, (_, index) => <LeaderSkeleton key={index} />)
                : leaders.map((item) => (
                    <div key={item.satId} className="ci-object-card">
                      <div>
                        <div className="ci-object-name">{item.objectName}</div>
                        <div className="ci-object-meta">
                          <span className="ci-object-id">NORAD {item.noradId}</span>
                          <span className="ci-object-alt">{item.altitudeKm ? `${Math.round(item.altitudeKm)} km` : "Altitude pending"}</span>
                        </div>
                      </div>
                      <div className="ci-object-score">
                        <strong>{item.odri.toFixed(3)}</strong>
                        <span>{item.riskLevel}</span>
                        <i className={`ci-object-trend ci-object-trend--${item.trend}`}>{item.trend}</i>
                      </div>
                    </div>
                  ))}
            </div>
          </div>

          <div className="ci-panel ci-brief">
            <div className="ci-panel-head">
              <div>
                <p className="ci-kicker">Analyst Feed</p>
                <h2 className="ci-title">Mission Brief</h2>
              </div>
            </div>
            <div className="ci-brief-list">
              <div className="ci-brief-item">
                <span className="ci-brief-label">Top threat</span>
                <strong>{leaders[0]?.objectName ?? "Pending live data"}</strong>
              </div>
              <div className="ci-brief-item">
                <span className="ci-brief-label">Network state</span>
                <strong>{getRiskLevel(stats.averageOdri)}</strong>
              </div>
              <div className="ci-brief-item">
                <span className="ci-brief-label">Conjunction pressure</span>
                <strong>{simulationPayload?.closest_pairs?.length ?? 0} screened pairs in focus</strong>
              </div>
            </div>
          </div>
        </aside>

        <article className="ci-panel ci-panel--chat">
          <div className="ci-panel-head">
            <div>
              <p className="ci-kicker">AI Debris Briefing</p>
              <h2 className="ci-title">Cascade Intelligence Agent</h2>
            </div>
            {chatHistory.length ? (
              <span className="ci-badge">
                Risk relevance {(((chatHistory.at(-1)?.riskRelevance ?? 0) * 100)).toFixed(0)}%
              </span>
            ) : null}
          </div>

          <form
            className="ci-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion();
            }}
          >
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              placeholder="Ask anything about debris cascading..."
              className="ci-textarea"
            />
            <div className="ci-form-row">
              <div className="ci-form-note">Live orbital analyst grounded in current ODRI, shell density, and conjunction data</div>
              <button type="submit" disabled={asking || !question.trim()} className="ci-submit">
                {asking ? "Analyzing..." : "Ask AI"}
              </button>
            </div>
          </form>

          <div className="ci-answer">
            {!chatHistory.length && !asking ? (
              <div className="ci-empty">
                <p>No questions yet.</p>
                <span>The console keeps a running chat history and grounds each answer in current orbital risk data.</span>
              </div>
            ) : (
              <div className="ci-chat-history">
                {chatHistory.map((entry) => (
                  <div key={entry.id} className={`ci-chat-row ci-chat-row--${entry.role}`}>
                    <div className={`ci-chat-bubble ci-chat-bubble--${entry.role}`}>
                      {entry.role === "assistant" ? (
                        <>
                          <div className="ci-answer-meta">
                            <span className="ci-answer-level">{entry.threatLevel}</span>
                            {(entry.systems ?? []).map((system) => (
                              <span key={system} className="ci-answer-system">{system}</span>
                            ))}
                          </div>
                          {entry.loading ? (
                            <div className="ci-typing" aria-label="AI is typing">
                              <span />
                              <span />
                              <span />
                            </div>
                          ) : (
                            <CascadeMarkdown markdown={entry.content} />
                          )}
                        </>
                      ) : (
                        <p>{entry.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>

        <aside className="ci-side ci-side--right">
          <div className="ci-panel">
            <div className="ci-panel-head">
              <div>
                <p className="ci-kicker">Live ODRI</p>
                <h2 className="ci-title">Cascade Effect Cards</h2>
              </div>
              <div className="ci-updated">Updated {formatTime(updatedAt)}</div>
            </div>
            <CascadeRiskCards cards={cards} loading={loading && !snapshot && !simulationPayload} />
          </div>
        </aside>
      </section>

      <CascadeTimeline timeline={timeline} loading={loading && !snapshot} />
    </div>
  );
}

export default function CascadeIntelligence() {
  return (
    <CascadeErrorBoundary>
      <CascadeIntelligenceContent />
    </CascadeErrorBoundary>
  );
}
