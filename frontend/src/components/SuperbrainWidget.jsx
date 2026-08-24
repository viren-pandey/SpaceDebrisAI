import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { askCascadeQuestion } from "../api/backend";
import CascadeMarkdown from "./cascade/CascadeMarkdown";

export default function SuperbrainWidget() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [asking, setAsking] = useState(false);
  const chatRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const submitQuestion = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const messageId = Date.now();
    setQuestion("");
    setAsking(true);
    setChatHistory(prev => [
      ...prev,
      { id: `wu-${messageId}`, role: "user", content: trimmed },
      { id: `wa-${messageId}`, role: "assistant", content: "", loading: true },
    ]);
    try {
      const data = await askCascadeQuestion({
        question: trimmed,
        context: { include_live_odri: true },
        system_prompt:
          "You are JARVIS — the SpaceDebrisAI Superbrain, an intelligent orbital risk analyst built by Viren. "
          + "You have access to live data from the SpaceDebrisAI platform, CelesTrak, ESA DISCOS, and Launch Library. "
          + "Your personality: Precise but conversational — like a brilliant space systems engineer who can explain things simply. "
          + "Use numbers and data when available from the context provided. "
          + "If a data source is unavailable or returned an error, be honest and explain what you know from domain knowledge. "
          + "Never make up NORAD IDs, conjunction probabilities, or specific risk scores. "
          + "Proactively suggest follow-up questions the user might want to ask. "
          + "Keep answers concise unless the user asks for depth. "
          + "Domain expertise: orbital mechanics, space situational awareness (SSA), debris mitigation (IADC guidelines), "
          + "TLE/SGP4 propagation, conjunction analysis, Kessler syndrome, LEO/MEO/GEO shell congestion, "
          + "the ODRI (Orbital Debris Risk Index), SpaceDebrisAI architecture. "
          + "When live data is injected into your context, use it directly and cite the source. "
          + "Format numbers cleanly. Use km, not meters, for orbital altitudes.",
      });
      setChatHistory(prev =>
        prev.map(entry =>
          entry.id === `wa-${messageId}`
            ? { ...entry, loading: false, content: data.answer }
            : entry
        )
      );
    } catch {
      setChatHistory(prev =>
        prev.map(entry =>
          entry.id === `wa-${messageId}`
            ? { ...entry, loading: false, content: "Cascade analysis service is unavailable. Please try again later." }
            : entry
        )
      );
    } finally {
      setAsking(false);
    }
  }, [question]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  };

  return (
    <div className="sb-root">
      {open && (
        <div className="sb-card">
          <div className="sb-card-header">
            <div className="sb-card-header-left">
              <span className="sb-card-title">JARVIS Superbrain</span>
              <span className="sb-card-subtitle">Orbital intelligence</span>
            </div>
            <button
              className="sb-expand-btn"
              onClick={() => navigate("/cascade-intelligence")}
              title="Open full page"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H2V6M10 2H14V6M2 10V14H6M14 10V14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="sb-chat" ref={chatRef}>
            {chatHistory.length === 0 && !asking && (
              <div className="sb-empty">
                Ask anything about orbital debris, conjunctions, or Kessler risk.
              </div>
            )}
            {chatHistory.map(entry => (
              <div key={entry.id} className={`sb-chat-row sb-chat-row--${entry.role}`}>
                <div className={`sb-chat-bubble sb-chat-bubble--${entry.role}`}>
                  {entry.role === "assistant" ? (
                    entry.loading ? (
                      <div className="ci-typing" aria-label="AI is typing">
                        <span /><span /><span />
                      </div>
                    ) : (
                      <CascadeMarkdown markdown={entry.content} />
                    )
                  ) : (
                    <p>{entry.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form className="sb-form" onSubmit={e => { e.preventDefault(); submitQuestion(); }}>
            <input
              className="sb-input"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about debris..."
              disabled={asking}
            />
            <button className="sb-send-btn" type="submit" disabled={asking || !question.trim()}>
              {asking ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}

      <button className="sb-trigger" onClick={() => setOpen(o => !o)} aria-label="Toggle Superbrain">
        <div className="sb-moon">
          <div className="sb-moon-crater" />
          <div className="sb-moon-crater sb-moon-crater--2" />
        </div>
        {!open && <span className="sb-trigger-label">Ask JARVIS</span>}
      </button>
    </div>
  );
}
