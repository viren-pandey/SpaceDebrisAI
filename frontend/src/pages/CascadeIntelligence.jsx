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
      caption: `${items.length} live high-risk objects are contributing to signal-routing volatility across tracked communication shells.`,
      updatedAt,
    },
    internet: {
      score: Math.max(averageScore * 0.96, averageOf(starlinkItems, (item) => item.odri ?? 0)),
      projectedScore: averageOf(starlinkItems, (item) => item.projected_odri ?? item.odri ?? 0),
      value: `${internetRisk.toFixed(1)}% constellation risk`,
      caption: `Starlink and other LEO broadband assets are exposed to the same dense shells driving the current ODRI leaders.`,
      updatedAt,
    },
    gps: {
      score: averageScore * 0.88,
      projectedScore: maxProjected * 0.84,
      value: `+${gpsDriftMeters.toFixed(1)} m positional drift`,
      caption: `Higher shell congestion increases shielding maneuvers and tracking uncertainty that can bleed into navigation resilience.`,
      updatedAt,
    },
    launch: {
      score: Math.max(averageScore, warnings * 0.08),
      projectedScore: Math.max(maxProjected, warnings * 0.09),
      value: `${blockedTrajectories} blocked trajectories`,
      caption: `Windows tighten as crowded shells require more avoidance screening before ascent corridors are cleared.`,
      updatedAt,
    },
    iss: {
      score: issItem?.odri ?? Math.max(averageScore, 0.24),
      projectedScore: issItem?.projected_odri ?? issItem?.odri ?? averageScore,
      value: `${Math.max(1, warnings)} conjunctions within 10 km`,
      caption: `Crewed-orbit exposure tracks the same warning set that feeds the live conjunction cache and ODRI ranking.`,
      updatedAt,
    },
    solar: {
      score: maxProjected * 0.78,
      projectedScore: maxProjected * 0.84,
      value: `${solarOcclusions} occlusion events / week`,
      caption: `Solar activity can amplify drag, reshuffle shell density, and raise the projected cascade burden for observation missions.`,
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
      setQuestion(nextQuestion);
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  }

  const topObjects = snapshot?.items ?? [];
  const summary = snapshot?.summary ?? {};

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-16 pt-8 md:px-6 xl:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-sky-400/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_42%),linear-gradient(135deg,rgba(2,6,23,0.95),rgba(15,23,42,0.88))] p-8 shadow-[0_30px_120px_rgba(2,12,24,0.55)]">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.35em] text-sky-300/80">Cascade Intelligence</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-6xl">Ask how orbital debris affects life on Earth</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            Grounded natural-language answers, live ODRI cards, and a forward view of how shell congestion can spill into navigation, connectivity, launches, and crew safety.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Tracked Objects</div>
            <div className="mt-2 text-3xl font-semibold text-white">{summary.tracked_count ?? "..."}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Average ODRI</div>
            <div className="mt-2 text-3xl font-semibold text-white">{(summary.average_odri ?? 0).toFixed(3)}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Active Warnings</div>
            <div className="mt-2 text-3xl font-semibold text-white">{summary.active_conjunction_warnings ?? 0}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_20px_80px_rgba(2,12,24,0.45)] backdrop-blur">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">AI Debris Briefing</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Cascade Intelligence Console</h2>
            </div>
            {response ? (
              <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-200">
                Risk relevance {(response.risk_relevance * 100).toFixed(0)}%
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => submitQuestion(item)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-sky-400/40 hover:bg-sky-400/10"
              >
                {item}
              </button>
            ))}
          </div>

          <form
            className="mt-6 flex flex-col gap-3"
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
              className="w-full rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Grounded in live ODRI and conjunction snapshot data
              </div>
              <button
                type="submit"
                disabled={asking}
                className="rounded-full bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {asking ? "Analyzing..." : "Ask AI"}
              </button>
            </div>
          </form>

          <div className="mt-6 min-h-[320px] rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.92))] p-5">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading live ODRI context...</div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
            ) : response ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-white/10 px-2.5 py-1">{response.cascade_threat_level}</span>
                  {response.affected_systems.map((system) => (
                    <span key={system} className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-sky-200">
                      {system}
                    </span>
                  ))}
                </div>
                <CascadeMarkdown markdown={typedAnswer || response.answer} />
              </div>
            ) : (
              <div className="flex h-full flex-col justify-center">
                <p className="text-lg font-medium text-white">No question submitted yet.</p>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                  Use the suggested prompts or ask your own question to get a grounded cascade analysis tied to the live orbital risk picture.
                </p>
              </div>
            )}
          </div>
        </article>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_20px_80px_rgba(2,12,24,0.45)] backdrop-blur">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Live ODRI</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Cascade Effect Cards</h2>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Updated</div>
                <div className="mt-1 text-slate-200">{formatTime(summary.updated_at)}</div>
              </div>
            </div>
            <CascadeRiskCards cards={cards} />
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_20px_80px_rgba(2,12,24,0.45)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Highest Risk Objects</p>
            <div className="mt-4 space-y-3">
              {topObjects.map((item) => (
                <div key={item.sat_id} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{item.object_name}</div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">NORAD {item.norad_id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-sky-300">{item.odri.toFixed(3)}</div>
                      <div className="text-xs text-slate-400">{item.risk_level}</div>
                    </div>
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
