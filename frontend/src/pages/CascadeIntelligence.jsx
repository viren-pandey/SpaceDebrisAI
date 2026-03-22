import { useEffect, useMemo, useRef, useState } from "react";
import CascadeMarkdown from "../components/cascade/CascadeMarkdown";
import CascadeRiskCards from "../components/cascade/CascadeRiskCards";
import CascadeTimeline from "../components/cascade/CascadeTimeline";
import { askCascadeQuestion, fetchOdriSnapshot } from "../api/backend";

const SUGGESTED_QUESTIONS = [
  "How does debris in LEO affect GPS signals?",
  "What happens if Kessler syndrome triggers?",
  "Which satellites are at highest risk right now?",
  "How does solar activity worsen debris cascading?",
  "What's the risk to ISS from current debris density?",
  "Could a cascade event affect internet connectivity?",
];

function formatTime(value) {
  if (!value) return "Pending";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function averageOf(items, selector) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + selector(item), 0) / items.length;
}

function buildDomainCards(snapshot) {
  const items = snapshot?.items ?? [];
  const summary = snapshot?.summary ?? {};
  const updatedAt = formatTime(summary.updated_at);
  const averageScore = summary.average_odri ?? averageOf(items, (item) => item.odri ?? 0);
  const maxProjected = Math.max(...items.map((item) => item.projected_odri ?? item.odri ?? 0), averageScore);
  const maxScore = Math.max(...items.map((item) => item.odri ?? 0), averageScore);
  const warnings = summary.active_conjunction_warnings ?? 0;
  const issItem = items.find((item) => item.object_name?.toLowerCase().includes("iss"));
  const starlinkItems = items.filter((item) => item.object_name?.toLowerCase().includes("starlink"));
  const satcomProbability = Math.min(97, maxProjected * 18000);
  const internetRisk = Math.min(96, averageOf(starlinkItems, (item) => item.odri ?? maxScore) * 22000);
  const gpsDriftMeters = Math.max(1.5, maxScore * 9000);
  const blockedTrajectories = Math.max(1, Math.round(warnings * 1.4 + maxProjected * 220));
  const solarOcclusions = Math.max(1, Math.round((summary.average_shell_density ?? 0) * 4e9 + maxProjected * 190));

  return {
    satcom: {
      score: Math.max(averageScore, maxProjected * 0.82),
      projectedScore: maxProjected,
      value: `${satcomProbability.toFixed(1)}% interference probability`,
      caption: `${items.length} live high-risk objects are stressing tracked communication shells.`,
      updatedAt,
    },
    internet: {
      score: Math.max(averageScore * 0.96, averageOf(starlinkItems, (item) => item.odri ?? 0)),
      projectedScore: averageOf(starlinkItems, (item) => item.projected_odri ?? item.odri ?? 0),
      value: `${internetRisk.toFixed(1)}% constellation risk`,
      caption: "LEO broadband fleets are exposed to the same density spikes driving the ODRI leaders.",
      updatedAt,
    },
    gps: {
      score: averageScore * 0.88,
      projectedScore: maxProjected * 0.84,
      value: `+${gpsDriftMeters.toFixed(1)} m positional drift`,
      caption: "Navigation resilience weakens when shell congestion forces more avoidance uncertainty.",
      updatedAt,
    },
    launch: {
      score: Math.max(averageScore, warnings * 0.08),
      projectedScore: Math.max(maxProjected, warnings * 0.09),
      value: `${blockedTrajectories} blocked trajectories`,
      caption: "Crowded shells compress launch timing because ascent corridors need more screening.",
      updatedAt,
    },
    iss: {
      score: issItem?.odri ?? Math.max(averageScore, 0.24),
      projectedScore: issItem?.projected_odri ?? issItem?.odri ?? averageScore,
      value: `${Math.max(1, warnings)} conjunctions within 10 km`,
      caption: "Crewed-orbit exposure follows the same warning set that feeds the live conjunction cache.",
      updatedAt,
    },
    solar: {
      score: maxProjected * 0.78,
      projectedScore: maxProjected * 0.84,
      value: `${solarOcclusions} occlusion events / week`,
      caption: "Solar activity can reshuffle drag and density, raising projected cascade stress.",
      updatedAt,
    },
  };
}

export default function CascadeIntelligence() {
  const [snapshot, setSnapshot] = useState(null);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  const answerTimerRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function loadSnapshot() {
      try {
        const data = await fetchOdriSnapshot(10);
        if (!active) return;
        setSnapshot(data);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSnapshot();
    const interval = setInterval(loadSnapshot, 60000);
    return () => {
      active = false;
      clearInterval(interval);
      if (answerTimerRef.current) {
        clearInterval(answerTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!response?.answer) return;
    if (answerTimerRef.current) {
      clearInterval(answerTimerRef.current);
    }
    setTypedAnswer("");
    let index = 0;
    answerTimerRef.current = setInterval(() => {
      index += 8;
      setTypedAnswer(response.answer.slice(0, index));
      if (index >= response.answer.length) {
        clearInterval(answerTimerRef.current);
      }
    }, 24);
    return () => {
      if (answerTimerRef.current) {
        clearInterval(answerTimerRef.current);
      }
    };
  }, [response]);

  const cards = useMemo(() => buildDomainCards(snapshot), [snapshot]);

  async function submitQuestion(nextQuestion) {
    if (!nextQuestion.trim()) return;
    setQuestion(nextQuestion);
    setAsking(true);
    setError(null);
    try {
      const data = await askCascadeQuestion({
        question: nextQuestion,
        context: {
          include_live_odri: true,
          sat_ids: (snapshot?.items ?? []).slice(0, 3).map((item) => item.sat_id),
        },
      });
      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  }

  const topObjects = snapshot?.items ?? [];
  const summary = snapshot?.summary ?? {};

  return (
    <div className="ci-page">
      <section className="page-hero ci-hero">
        <p className="page-hero-eyebrow">Live ODRI Snapshot | Cascade Analysis | Earth Impact View</p>
        <h1 className="page-hero-title">
          Cascade
          <br />
          <span style={{ color: "var(--accent)" }}>Intelligence</span>
        </h1>
        <p className="page-hero-sub">
          Ask how orbital debris affects life on Earth, grounded in live ODRI scores, shell density, and conjunction pressure.
        </p>

        <div className="ci-hero-stats">
          <div className="ci-stat">
            <span className="ci-stat-value">{summary.tracked_count ?? "..."}</span>
            <span className="ci-stat-label">tracked objects</span>
          </div>
          <div className="ci-stat">
            <span className="ci-stat-value">{(summary.average_odri ?? 0).toFixed(3)}</span>
            <span className="ci-stat-label">average ODRI</span>
          </div>
          <div className="ci-stat">
            <span className="ci-stat-value">{summary.active_conjunction_warnings ?? 0}</span>
            <span className="ci-stat-label">active warnings</span>
          </div>
        </div>
      </section>

      <section className="ci-grid">
        <article className="ci-panel">
          <div className="ci-panel-head">
            <div>
              <p className="ci-kicker">AI Debris Briefing</p>
              <h2 className="ci-title">Cascade Intelligence Console</h2>
            </div>
            {response ? (
              <span className="ci-badge">
                Risk relevance {(response.risk_relevance * 100).toFixed(0)}%
              </span>
            ) : null}
          </div>

          <div className="ci-chip-row">
            {SUGGESTED_QUESTIONS.map((item) => (
              <button key={item} type="button" onClick={() => submitQuestion(item)} className="ci-chip">
                {item}
              </button>
            ))}
          </div>

          <form
            className="ci-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion(question);
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
              <div className="ci-form-note">Grounded in live ODRI and conjunction snapshot data</div>
              <button type="submit" disabled={asking} className="ci-submit">
                {asking ? "Analyzing..." : "Ask AI"}
              </button>
            </div>
          </form>

          <div className="ci-answer">
            {loading ? (
              <div className="ci-empty">Loading live ODRI context...</div>
            ) : error ? (
              <div className="error-state"><p>{error}</p></div>
            ) : response ? (
              <div className="ci-answer-wrap">
                <div className="ci-answer-meta">
                  <span className="ci-answer-level">{response.cascade_threat_level}</span>
                  {response.affected_systems.map((system) => (
                    <span key={system} className="ci-answer-system">{system}</span>
                  ))}
                </div>
                <CascadeMarkdown markdown={typedAnswer || response.answer} />
              </div>
            ) : (
              <div className="ci-empty">
                <p>No question submitted yet.</p>
                <span>Use the suggested prompts or ask your own question to get a grounded cascade analysis.</span>
              </div>
            )}
          </div>
        </article>

        <aside className="ci-side">
          <div className="ci-panel">
            <div className="ci-panel-head">
              <div>
                <p className="ci-kicker">Live ODRI</p>
                <h2 className="ci-title">Cascade Effect Cards</h2>
              </div>
              <div className="ci-updated">Updated {formatTime(summary.updated_at)}</div>
            </div>
            <CascadeRiskCards cards={cards} />
          </div>

          <div className="ci-panel">
            <div className="ci-panel-head">
              <div>
                <p className="ci-kicker">Highest Risk Objects</p>
                <h2 className="ci-title">Current Leaders</h2>
              </div>
            </div>
            <div className="ci-object-list">
              {topObjects.map((item) => (
                <div key={item.sat_id} className="ci-object-card">
                  <div>
                    <div className="ci-object-name">{item.object_name}</div>
                    <div className="ci-object-id">NORAD {item.norad_id}</div>
                  </div>
                  <div className="ci-object-score">
                    <strong>{item.odri.toFixed(3)}</strong>
                    <span>{item.risk_level}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <CascadeTimeline timeline={snapshot?.timeline ?? []} />
    </div>
  );
}
