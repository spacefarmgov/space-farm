import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  CloudRain,
  Droplets,
  MapPin,
  Send,
  Sparkles,
  Thermometer,
  Trash2,
} from "lucide-react";
import {
  SpaceFarmApiError,
  askSpaceFarmAi,
  clearAiHistory,
  fetchAiHistory,
  type AiChatMessage,
} from "../api/extendedClient";
import { getClimateFeatureValue, toSimulationRequest } from "../data/regions";
import { formatLocaleNumber } from "../locales/translations";
import { AppShell } from "../components/layout/AppShell";
import { useSpaceFarm } from "../context/SpaceFarmContext";
import { formatLatLon } from "../utils/locationSearch";

function renderFormattedText(content: string) {
  const blocks = content.split(/\n{2,}/);
  return blocks.map((block, idx) => {
    const rawLines = block.split("\n").filter((l) => l.trim());
    if (rawLines.length === 1 && /^#{1,4}\s+/.test(rawLines[0])) {
      const headingText = rawLines[0].replace(/^#{1,4}\s+/, "");
      return (
        <h4 key={idx} className="sf-ai-heading">
          {renderInlineFormatting(headingText)}
        </h4>
      );
    }
    const isBulletList = rawLines.length > 0 && rawLines.every((l) => /^\s*[-•*]\s+/.test(l));
    if (isBulletList) {
      return (
        <ul key={idx} className="sf-ai-list">
          {rawLines.map((line, li) => (
            <li key={li}>{renderInlineFormatting(line.replace(/^\s*[-•*]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }
    const isOrderedList = rawLines.length > 0 && rawLines.every((l) => /^\s*\d+\.\s+/.test(l));
    if (isOrderedList) {
      return (
        <ol key={idx} className="sf-ai-list sf-ai-olist">
          {rawLines.map((line, li) => (
            <li key={li}>{renderInlineFormatting(line.replace(/^\s*\d+\.\s+/, ""))}</li>
          ))}
        </ol>
      );
    }
    return (
      <div key={idx} className="sf-ai-p">
        {rawLines.map((line, li) => {
          if (/^#{1,4}\s+/.test(line)) {
            return (
              <h4 key={li} className="sf-ai-heading">
                {renderInlineFormatting(line.replace(/^#{1,4}\s+/, ""))}
              </h4>
            );
          }
          return (
            <Fragment key={li}>
              {li > 0 && <br />}
              {renderInlineFormatting(line)}
            </Fragment>
          );
        })}
      </div>
    );
  });
}

function renderInlineFormatting(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="sf-ai-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}

export function SpaceFarmAiPage() {
  const {
    locale,
    t,
    authToken,
    draft,
    requestedWeights,
    climate,
    loadClimateForField,
    showToast,
  } = useSpaceFarm();
  const navigate = useNavigate();
  const endRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!climate) {
      void loadClimateForField();
    }
  }, [climate, loadClimateForField]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    setLoadingHistory(true);
    fetchAiHistory(authToken)
      .then((res) => {
        if (!cancelled) {
          setMessages(res.messages);
        }
      })
      .catch(() => {
        // non-blocking history load
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  async function submitQuestion(text: string) {
    const clean = text.trim();
    if (!clean || sending || !authToken) return;
    setErrorMsg(null);
    setSending(true);

    const optimisticUser: AiChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: clean,
      meta: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");

    try {
      const simReq = toSimulationRequest(draft, requestedWeights, 1.0);
      const res = await askSpaceFarmAi(authToken, {
        question: clean,
        locale,
        farm: simReq.farm,
        preferences: simReq.preferences,
        scenario: simReq.scenario,
      });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        res.user_message,
        res.assistant_message,
      ]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      if (err instanceof SpaceFarmApiError && err.status === 401) {
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : t.errors.unexpectedBody);
      setInput(clean);
    } finally {
      setSending(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitQuestion(input);
  }

  async function handleClear() {
    if (!authToken || messages.length === 0) return;
    try {
      await clearAiHistory(authToken);
      setMessages([]);
      showToast(t.aiPage.clearBtn);
    } catch {
      // ignore error
    }
  }

  const ai = t.aiPage;
  const meanTemp = getClimateFeatureValue(climate, "mean_temperature");
  const totalPrecip = getClimateFeatureValue(climate, "total_precipitation_mm");
  const rootWet = getClimateFeatureValue(climate, "mean_root_zone_soil_wetness");

  return (
    <AppShell>
      <div className="sf-container sf-section" style={{ paddingTop: 28, paddingBottom: 48 }}>
      <div className="sf-page-head" style={{ marginBottom: 20 }}>
        <div>
          <span className="sf-badge sf-badge-cyan" style={{ marginBottom: 8 }}>
            <Sparkles size={12} aria-hidden="true" />
            <span>{ai.badge}</span>
          </span>
          <h1>{ai.title}</h1>
          <p className="sf-subtitle">{ai.subtitle}</p>
        </div>

        {messages.length > 0 && (
          <button type="button" className="sf-btn sf-btn-sm" onClick={() => void handleClear()}>
            <Trash2 size={14} aria-hidden="true" />
            <span>{ai.clearBtn}</span>
          </button>
        )}
      </div>

      <div className="sf-ai-layout">
        {/* Left Context & Quick Prompts Sidebar */}
        <aside className="sf-ai-sidebar">
          <section className="sf-panel sf-panel-compact">
            <h2 style={{ fontSize: 15.5, marginBottom: 12 }}>{ai.contextTitle}</h2>
            <div className="sf-ai-ctx-list">
              <div className="sf-ai-ctx-item">
                <MapPin size={14} aria-hidden="true" />
                <div>
                  <span>{ai.contextField}</span>
                  <strong>{draft.label}</strong>
                  <small className="mono">
                    {formatLatLon(draft.latitude, draft.longitude, 2)} · {draft.areaHa} ha
                  </small>
                </div>
              </div>

              <div className="sf-ai-ctx-item">
                <Thermometer size={14} aria-hidden="true" />
                <div>
                  <span>{ai.contextTemp}</span>
                  <strong>
                    {meanTemp !== null ? `${formatLocaleNumber(meanTemp, locale, 1)} °C` : "—"}
                  </strong>
                </div>
              </div>

              <div className="sf-ai-ctx-item">
                <CloudRain size={14} aria-hidden="true" />
                <div>
                  <span>{ai.contextPrecip}</span>
                  <strong>
                    {totalPrecip !== null
                      ? `${formatLocaleNumber(totalPrecip, locale, 1)} mm`
                      : "—"}
                  </strong>
                </div>
              </div>

              <div className="sf-ai-ctx-item">
                <Droplets size={14} aria-hidden="true" />
                <div>
                  <span>{ai.contextMoisture}</span>
                  <strong>
                    {rootWet !== null ? `${Math.round(rootWet * 100)}%` : "—"}
                  </strong>
                </div>
              </div>

              <div className="sf-ai-ctx-item">
                <Bot size={14} aria-hidden="true" />
                <div>
                  <span>{ai.contextPh}</span>
                  <strong>
                    pH {draft.soilPh.toFixed(1)} · Humus {draft.labMetrics.organicMatterPct.toFixed(1)}% · N {draft.labMetrics.nitrogenMgKg}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section className="sf-panel sf-panel-compact">
            <h2 style={{ fontSize: 14.5, marginBottom: 10 }}>
              {locale === "az" ? "Hazır suallar" : "Suggested prompts"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ai.promptStarters.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="sf-ai-starter-btn"
                  disabled={sending}
                  onClick={() => void submitQuestion(prompt)}
                >
                  <span>{prompt}</span>
                  <ArrowRight size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </aside>

        {/* Main Chat Panel */}
        <section className="sf-panel sf-ai-chat-card">
          <div className="sf-ai-thread">
            {loadingHistory && messages.length === 0 ? (
              <div className="sf-ai-empty">
                <p>{ai.sendingBtn}</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="sf-ai-empty">
                <div className="sf-ai-empty-icon">
                  <Bot size={26} aria-hidden="true" />
                </div>
                <h3>{ai.emptyTitle}</h3>
                <p>{ai.emptyBody}</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`sf-ai-msg ${isUser ? "is-user" : "is-assistant"}`}
                  >
                    <div className="sf-ai-bubble">
                      {!isUser && msg.meta?.engine && (
                        <div className="sf-ai-engine-tag">
                          <Sparkles size={11} aria-hidden="true" />
                          <span>{msg.meta.engine}</span>
                          {msg.meta.data_mode && (
                            <span className="mono"> · {msg.meta.data_mode}</span>
                          )}
                        </div>
                      )}

                      <div className="sf-ai-body">
                        {isUser ? <p className="sf-ai-p">{msg.content}</p> : renderFormattedText(msg.content)}
                      </div>

                      {!isUser && msg.meta?.metrics && msg.meta.metrics.length > 0 && (
                        <div className="sf-ai-metrics-row">
                          {msg.meta.metrics.map((m) => (
                            <div key={m.label} className="sf-ai-metric-chip">
                              <span>{m.label}</span>
                              <strong className="mono">{m.value}</strong>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isUser && msg.meta?.actions && msg.meta.actions.length > 0 && (
                        <div className="sf-ai-actions-row">
                          {msg.meta.actions.map((act) => (
                            <button
                              key={act.route}
                              type="button"
                              className="sf-btn sf-btn-sm"
                              onClick={() => navigate(act.route)}
                            >
                              <span>{act.label}</span>
                              <ArrowRight size={12} aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {sending && (
              <div className="sf-ai-msg is-assistant">
                <div className="sf-ai-bubble sf-ai-typing">
                  <span>{ai.sendingBtn}</span>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {errorMsg && (
            <div className="sf-banner sf-banner-error" role="alert" style={{ margin: "0 18px 10px" }}>
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="sf-ai-composer" onSubmit={handleFormSubmit}>
            <input
              type="text"
              className="sf-ai-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ai.inputPlaceholder}
              disabled={sending}
            />
            <button
              type="submit"
              className="sf-btn sf-btn-primary"
              disabled={sending || !input.trim()}
            >
              <Send size={15} aria-hidden="true" />
              <span>{sending ? ai.sendingBtn : ai.sendBtn}</span>
            </button>
          </form>

          <p className="sf-ai-footer-note">{ai.sourceFooter}</p>
        </section>
      </div>
      </div>
    </AppShell>
  );
}
