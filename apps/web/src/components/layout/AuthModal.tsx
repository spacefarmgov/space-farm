import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Lock, LogIn, UserPlus, X } from "lucide-react";
import { useSpaceFarm } from "../../context/SpaceFarmContext";

export function AuthModal() {
  const {
    t,
    authModalOpen,
    authModalTab,
    authAlertMessage,
    pendingRedirectPath,
    openAuthModal,
    closeAuthModal,
    loginUser,
    registerUser,
  } = useSpaceFarm();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState("Ganja-Dashkasan");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormError(null);
  }, [authModalOpen, authModalTab]);

  useEffect(() => {
    if (!authModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAuthModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen || typeof document === "undefined") {
    return null;
  }

  const isLogin = authModalTab === "login";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setSubmitting(true);

    const result = isLogin
      ? await loginUser(email, password)
      : await registerUser(name, email, password, region);

    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error ?? t.auth.invalidCredentials);
      return;
    }

    const destination =
      pendingRedirectPath && pendingRedirectPath !== "/"
        ? pendingRedirectPath
        : "/explore";
    navigate(destination, { replace: true });
  }

  return createPortal(
    <div
      className="sf-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeAuthModal();
        }
      }}
    >
      <div
        className="sf-modal sf-auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="sf-badge sf-badge-violet" style={{ marginBottom: 8 }}>
              <Lock size={12} aria-hidden="true" />
              <span>SpaceFarm Auth</span>
            </div>
            <h2 id="auth-modal-title" className="sf-section-title">
              {isLogin ? t.auth.loginTitle : t.auth.registerTitle}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-secondary)" }}>
              {t.auth.subtitle}
            </p>
          </div>

          <button
            type="button"
            className="sf-btn sf-btn-sm"
            onClick={closeAuthModal}
            aria-label={t.actions.close}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {authAlertMessage && (
          <div className="sf-auth-alert" role="alert">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.auth.alertRequiredTitle}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                {authAlertMessage}
              </div>
            </div>
          </div>
        )}

        <div className="sf-auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={`sf-auth-tab ${isLogin ? "active" : ""}`}
            onClick={() => openAuthModal("login", authAlertMessage, pendingRedirectPath)}
          >
            <LogIn size={15} aria-hidden="true" />
            <span>{t.auth.tabLogin}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={`sf-auth-tab ${!isLogin ? "active" : ""}`}
            onClick={() => openAuthModal("register", authAlertMessage, pendingRedirectPath)}
          >
            <UserPlus size={15} aria-hidden="true" />
            <span>{t.auth.tabRegister}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }} noValidate>
          {!isLogin && (
            <label className="sf-field">
              <span className="sf-label-row">{t.auth.nameLabel}</span>
              <input
                type="text"
                className="sf-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.auth.namePlaceholder}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label className="sf-field">
            <span className="sf-label-row">{t.auth.emailLabel}</span>
            <input
              type="email"
              className="sf-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              autoComplete="email"
              required
            />
          </label>

          <label className="sf-field">
            <span className="sf-label-row">{t.auth.passwordLabel}</span>
            <input
              type="password"
              className="sf-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.auth.passwordPlaceholder}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
            />
          </label>

          {!isLogin && (
            <label className="sf-field">
              <span className="sf-label-row">{t.auth.regionLabel}</span>
              <select
                className="sf-select"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="Ganja-Dashkasan">Gəncə-Daşkəsən (40.68°N, 46.36°E)</option>
                <option value="Aran / Barda-Yevlakh">Aran / Bərdə-Yevlax (40.38°N, 47.12°E)</option>
                <option value="Guba-Khachmaz">Quba-Xaçmaz (41.36°N, 48.51°E)</option>
                <option value="Shaki-Zagatala">Şəki-Zaqatala (41.19°N, 47.17°E)</option>
              </select>
            </label>
          )}

          {formError && (
            <div className="sf-auth-error" role="alert">
              {formError}
            </div>
          )}

          <button type="submit" className="sf-btn sf-btn-primary" disabled={submitting} style={{ width: "100%" }}>
            {isLogin ? <LogIn size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
            <span>{isLogin ? t.auth.submitLogin : t.auth.submitRegister}</span>
          </button>

          <button
            type="button"
            className="sf-auth-switch"
            onClick={() => openAuthModal(isLogin ? "register" : "login", authAlertMessage, pendingRedirectPath)}
          >
            {isLogin ? t.auth.switchToRegister : t.auth.switchToLogin}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
