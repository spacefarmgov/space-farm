import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Globe, KeyRound, MailCheck, X } from "lucide-react";
import {
  fetchAuthProviders,
  getFriendlyErrorMessage,
  loginWithGoogleToken,
  requestPasswordReset,
  requestRegistrationOtp,
  resetPasswordWithCode,
  verifyRegistrationOtp,
} from "../api/extendedClient";
import { HeroTypewriter } from "../components/features/HeroTypewriter";
import { SpiderWebCanvas } from "../components/layout/SpiderWebCanvas";
import { useSpaceFarm } from "../context/SpaceFarmContext";
import { VERIFIED_AZ_REGIONS } from "../data/regions";
import { AZ_DISTRICTS } from "../data/azDistricts";
import "../styles/auth-page.css";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
          }) => void;
          renderButton: (
            el: HTMLElement,
            options: Record<string, string | number>,
          ) => void;
        };
      };
    };
  }
}

export type AuthRouteMode = "login" | "register" | "forgot-password";

interface AuthLocationState {
  alertMessage?: string | null;
  redirectTo?: string | null;
}

export function AuthPage({ initialMode }: { initialMode: AuthRouteMode }) {
  const {
    locale,
    setLocale,
    t,
    user,
    authAlertMessage,
    pendingRedirectPath,
    loginUser,
    registerUser,
    establishAuthSession,
  } = useSpaceFarm();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as AuthLocationState | null) ?? null;

  const [mode, setMode] = useState<AuthRouteMode>(initialMode);
  const [animDir, setAnimDir] = useState<"forward" | "backward">("forward");
  const [animKey, setAnimKey] = useState(0);
  const storyRef = useRef<HTMLElement | null>(null);
  const accountRef = useRef<HTMLElement | null>(null);
  const googleBtnHostRef = useRef<HTMLDivElement | null>(null);

  // Form states preserved in memory cleanly across animated Login <-> Register transitions
  const [fullName, setFullName] = useState("");
  const [region, setRegion] = useState("Ganja-Dashkasan");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Multi-step Email OTP (Register) & 6-digit Recovery Code (Forgot Password) states
  const [registerStep, setRegisterStep] = useState<"form" | "otp">("form");
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [resetCode, setResetCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const envGoogleId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  const [authProviders, setAuthProviders] = useState<{
    google_enabled: boolean;
    google_client_id: string;
    smtp_configured: boolean;
  }>({
    google_enabled: Boolean(envGoogleId),
    google_client_id: envGoogleId,
    smtp_configured: false,
  });
  const [gsiFailed, setGsiFailed] = useState(false);

  const [statusNotice, setStatusNotice] = useState<{
    message: string;
    tone: "error" | "success" | "info";
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    otpCode?: string;
    resetCode?: string;
    newPassword?: string;
    agreement?: string;
  }>({});
  const [policyModal, setPolicyModal] = useState<"privacy" | "terms" | null>(null);

  const blockedAlert = routeState?.alertMessage ?? authAlertMessage;
  const redirectTarget =
    routeState?.redirectTo ??
    (pendingRedirectPath && pendingRedirectPath !== "/" ? pendingRedirectPath : "/explore");

  // Discover live Google OAuth & SMTP status from backend (no secrets exposed)
  useEffect(() => {
    const controller = new AbortController();
    fetchAuthProviders(controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const resolvedClientId = (res.google_client_id || envGoogleId).trim();
        setAuthProviders({
          google_enabled: Boolean(resolvedClientId),
          google_client_id: resolvedClientId,
          smtp_configured: Boolean(res.smtp_configured),
        });
      })
      .catch(() => {
        // Ignore transient network errors on initial discovery
      });
    return () => controller.abort();
  }, [envGoogleId]);

  // OTP resend countdown ticker
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const id = window.setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [otpCooldown]);

  // Mount live Google Identity Services button whenever GOOGLE_CLIENT_ID is configured
  useEffect(() => {
    const clientId = authProviders.google_client_id.trim();
    const host = googleBtnHostRef.current;
    if (!clientId || !host || mode === "forgot-password" || registerStep === "otp") {
      return;
    }
    let cancelled = false;
    const renderGoogleBtn = () => {
      if (cancelled || !googleBtnHostRef.current || !window.google?.accounts?.id) return;
      googleBtnHostRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: { credential?: string }) => {
          if (!resp.credential) return;
          setIsSubmitting(true);
          setStatusNotice(null);
          try {
            const session = await loginWithGoogleToken({
              credential: resp.credential,
              region,
            });
            establishAuthSession(session, t.auth.welcomeBack);
            navigate(redirectTarget, { replace: true });
          } catch (err) {
            setStatusNotice({
              message: getFriendlyErrorMessage(
                err,
                t.errors.apiUnreachableTitle,
                t.auth.invalidCredentials,
              ),
              tone: "error",
            });
          } finally {
            setIsSubmitting(false);
          }
        },
      });
      setGsiFailed(false);
      window.google.accounts.id.renderButton(googleBtnHostRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        locale,
        width: Math.min(400, Math.max(240, googleBtnHostRef.current.clientWidth || 360)),
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleBtn();
      return () => {
        cancelled = true;
      };
    }

    const handleScriptError = () => {
      if (!cancelled) setGsiFailed(true);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    const script = existingScript ?? document.createElement("script");
    if (!existingScript) {
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderGoogleBtn);
    script.addEventListener("error", handleScriptError);
    return () => {
      cancelled = true;
      script.removeEventListener("load", renderGoogleBtn);
      script.removeEventListener("error", handleScriptError);
    };
  }, [authProviders.google_client_id, establishAuthSession, locale, mode, navigate, redirectTarget, region, registerStep, t.auth.invalidCredentials, t.auth.welcomeBack, t.errors.apiUnreachableTitle]);

  // Already logged in -> jump straight to Dashboard
  useEffect(() => {
    if (user) {
      navigate(redirectTarget, { replace: true });
    }
  }, [navigate, redirectTarget, user]);

  // Sync mode when URL path updates directly (/login, /register, /forgot-password)
  useEffect(() => {
    if (initialMode !== mode) {
      const order: Record<AuthRouteMode, number> = {
        login: 0,
        register: 1,
        "forgot-password": 2,
      };
      setAnimDir(order[initialMode] >= order[mode] ? "forward" : "backward");
      setAnimKey((k) => k + 1);
      setMode(initialMode);
      setPassword("");
      setShowPassword(false);
      setRegisterStep("form");
      setOtpToken("");
      setResetStep("request");
      setResetToken("");
      setFieldErrors({});
      setStatusNotice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  function switchMode(
    nextMode: AuthRouteMode,
    preservedNotice?: { message: string; tone: "error" | "success" | "info" },
  ) {
    if (nextMode === mode && !preservedNotice) return;
    const order: Record<AuthRouteMode, number> = {
      login: 0,
      register: 1,
      "forgot-password": 2,
    };
    setAnimDir(order[nextMode] >= order[mode] ? "forward" : "backward");
    setAnimKey((k) => k + 1);
    setMode(nextMode);
    setPassword("");
    setShowPassword(false);
    setRegisterStep("form");
    setOtpCode("");
    setOtpToken("");
    setResetStep("request");
    setResetCode("");
    setResetToken("");
    setNewPassword("");
    setFieldErrors({});
    setStatusNotice(preservedNotice ?? null);
    const nextPath =
      nextMode === "register"
        ? "/register"
        : nextMode === "forgot-password"
          ? "/forgot-password"
          : "/login";
    navigate(nextPath, {
      replace: true,
      state: { alertMessage: blockedAlert, redirectTo: redirectTarget },
    });
  }

  async function handleResendOtp() {
    if (otpCooldown > 0 || isSubmitting) return;
    setIsSubmitting(true);
    setStatusNotice(null);
    try {
      const res = await requestRegistrationOtp({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        region,
      });
      setOtpToken(res.otp_token ?? "");
      setOtpCooldown(45);
      setStatusNotice({
        message: `${t.authPage.otpSentNotice} ${email.trim().toLowerCase()}`,
        tone: "success",
      });
    } catch (err) {
      setStatusNotice({
        message: getFriendlyErrorMessage(
          err,
          t.errors.apiUnreachableTitle,
          t.authPage.smtpRequiredNotice,
        ),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatusNotice(null);

    const ap = t.authPage;
    const nextErrs: typeof fieldErrors = {};
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();

    if (mode === "register" && registerStep === "otp") {
      const cleanOtp = otpCode.replace(/\D/g, "");
      if (cleanOtp.length !== 4) {
        setFieldErrors({ otpCode: ap.otpInvalid });
        return;
      }
      setIsSubmitting(true);
      try {
        const session = await verifyRegistrationOtp({
          email: trimmedEmail,
          code: cleanOtp,
          otp_token: otpToken || undefined,
        });
        establishAuthSession(session, t.auth.accountCreated);
        navigate(redirectTarget, { replace: true });
      } catch (err) {
        setStatusNotice({
          message: getFriendlyErrorMessage(err, t.errors.apiUnreachableTitle, ap.otpInvalid),
          tone: "error",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === "forgot-password") {
      if (!trimmedEmail || !trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
        nextErrs.email = t.auth.invalidEmail;
      }
      if (resetStep === "verify") {
        if (resetCode.replace(/\D/g, "").length !== 6) {
          nextErrs.resetCode = ap.resetCodePlaceholder;
        }
        if (newPassword.length < 6) {
          nextErrs.newPassword = t.auth.shortPassword;
        }
      }
      if (Object.keys(nextErrs).length > 0) {
        setFieldErrors(nextErrs);
        return;
      }

      setIsSubmitting(true);
      try {
        if (resetStep === "request") {
          const res = await requestPasswordReset(trimmedEmail);
          setResetToken(res.reset_token ?? "");
          if (res.smtp_configured && res.code_dispatched) {
            setResetStep("verify");
            setStatusNotice({ message: ap.resetSent, tone: "success" });
          } else {
            setStatusNotice({
              message: `${ap.smtpRequiredNotice} [${res.delivery_status}]`,
              tone: "info",
            });
          }
        } else {
          await resetPasswordWithCode({
            email: trimmedEmail,
            code: resetCode.replace(/\D/g, ""),
            new_password: newPassword,
            reset_token: resetToken || undefined,
          });
          switchMode("login", { message: ap.resetSuccess, tone: "success" });
        }
      } catch (err) {
        setStatusNotice({
          message: getFriendlyErrorMessage(err, t.errors.apiUnreachableTitle, t.auth.invalidEmail),
          tone: "error",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === "register" && trimmedName.length < 2) {
      nextErrs.fullName = t.auth.shortName;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      nextErrs.email = t.auth.invalidEmail;
    }
    if (password.length < 6) {
      nextErrs.password = t.auth.shortPassword;
    }
    if (mode === "register" && !agreedTerms) {
      nextErrs.agreement = ap.termsRequired;
    }

    if (Object.keys(nextErrs).length > 0) {
      setFieldErrors(nextErrs);
      return;
    }

    if (mode === "register") {
      setIsSubmitting(true);
      if (authProviders.smtp_configured) {
        try {
          const otpRes = await requestRegistrationOtp({
            name: trimmedName,
            email: trimmedEmail,
            password,
            region,
          });
          setOtpToken(otpRes.otp_token ?? "");
          setRegisterStep("otp");
          setOtpCode("");
          setOtpCooldown(45);
          setStatusNotice({
            message: `${ap.otpSentNotice} ${trimmedEmail}`,
            tone: "success",
          });
        } catch (err) {
          setStatusNotice({
            message: getFriendlyErrorMessage(
              err,
              t.errors.apiUnreachableTitle,
              ap.smtpRequiredNotice,
            ),
            tone: "error",
          });
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      const regResult = await registerUser(trimmedName, trimmedEmail, password, region);
      setIsSubmitting(false);
      if (!regResult.ok) {
        setStatusNotice({
          message: regResult.error ?? t.auth.invalidCredentials,
          tone: "error",
        });
        return;
      }
      navigate(redirectTarget, { replace: true });
      return;
    }

    setIsSubmitting(true);
    const result = await loginUser(trimmedEmail, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setStatusNotice({
        message: result.error ?? t.auth.invalidCredentials,
        tone: "error",
      });
      return;
    }

    navigate(redirectTarget, { replace: true });
  }

  function handleGoogleClick() {
    if (mode === "register" && !agreedTerms) {
      setFieldErrors((prev) => ({ ...prev, agreement: t.authPage.termsRequired }));
      return;
    }
    setStatusNotice({ message: t.authPage.googleNotConfigured, tone: "info" });
  }

  const ap = t.authPage;
  const activeCycleWords = mode === "register" ? ap.registerCycleWords : ap.loginCycleWords;
  const activeAccentFallback = activeCycleWords[0] || ap.heroLine3;
  const heading =
    mode === "forgot-password"
      ? resetStep === "verify"
        ? ap.resetCodeTitle
        : ap.resetTitle
      : mode === "register"
        ? registerStep === "otp"
          ? ap.verifyOtpTitle
          : ap.createTitle
        : ap.welcome;
  const subtitle =
    mode === "forgot-password"
      ? resetStep === "verify"
        ? ap.resetCodeSubtitle
        : ap.resetSubtitle
      : mode === "register"
        ? registerStep === "otp"
          ? ap.verifyOtpSubtitle
          : ap.createSubtitle
        : ap.welcomeSubtitle;

  return (
    <div className="sf-auth-shell">
      <main className="sf-auth-layout">
        {/* Left Story Visual Panel matching SpaceFarm-Auth */}
        <section ref={storyRef} className="sf-auth-story" aria-label="SpaceFarm">
          <img
            className="sf-auth-story-art"
            src="/assets/orbital-farmland.png"
            alt=""
            aria-hidden="true"
          />
          <div className="sf-auth-story-shade" aria-hidden="true" />
          <SpiderWebCanvas hostRef={storyRef} className="sf-auth-story-fx" />

          <div className="sf-auth-story-top">
            <Link to="/" className="sf-auth-brand" aria-label="SpaceFarm Home">
              <img src="/assets/spacefarm-mark.svg" width={54} height={54} alt="" />
              <span className="sf-auth-brand-type">
                <strong>SpaceFarm</strong>
                <span>{t.byline}</span>
              </span>
            </Link>

            <Link to="/" className="sf-auth-back-pill">
              <ArrowLeft size={14} aria-hidden="true" />
              <span>{ap.backHome}</span>
            </Link>
          </div>

          <div className="sf-auth-story-copy">
            <p className="sf-auth-eyebrow">{ap.eyebrow}</p>
            <h1>
              <span className="sf-sr-only">
                {ap.heroLine1} {ap.heroLine2} {activeAccentFallback}
              </span>
              <span aria-hidden="true">
                <span className="sf-auth-h1-line">{ap.heroLine1}</span>
                <span className="sf-auth-h1-line">{ap.heroLine2}</span>
                <span className="sf-auth-h1-sizer">
                  {activeCycleWords.map((word) => (
                    <span key={word} className="sf-auth-h1-ghost">
                      {word}
                      <span className="sf-typewriter-caret" />
                    </span>
                  ))}
                  <span className="sf-auth-h1-live">
                    <HeroTypewriter words={activeCycleWords} fallback={activeAccentFallback} />
                  </span>
                </span>
              </span>
            </h1>
            <p className="sf-auth-story-desc">{ap.heroDescription}</p>
          </div>

          <div className="sf-auth-story-footer">
            <p>{ap.storyFooter}</p>
            <div className="sf-auth-feature-tags" aria-label="Features">
              <span>{ap.satelliteInsights}</span>
              <span>{ap.cropRotation}</span>
            </div>
          </div>
        </section>

        {/* Right Account Form Panel */}
        <section ref={accountRef} className="sf-auth-account" aria-labelledby="auth-page-heading">
          <SpiderWebCanvas hostRef={accountRef} className="sf-auth-account-fx" />
          <div className="sf-auth-topbar-controls">
            <Link to="/" className="sf-auth-back-pill sf-auth-mobile-back">
              <ArrowLeft size={13} aria-hidden="true" />
              <span>{ap.backHome}</span>
            </Link>

            <button
              type="button"
              className="sf-auth-lang-pill"
              onClick={() => setLocale(locale === "az" ? "en" : "az")}
              aria-label="Toggle language"
            >
              <Globe size={14} aria-hidden="true" />
              <span>{locale === "az" ? "AZ" : "EN"}</span>
            </button>
          </div>

          <div className="sf-auth-stage">
            <div className="sf-auth-card">
              {/* Alert banner when redirected from a blocked route */}
              {blockedAlert && (
                <div className="sf-auth-alert" role="alert" style={{ marginBottom: 18 }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.auth.alertRequiredTitle}</div>
                    <div style={{ fontSize: 12.5, marginTop: 2, opacity: 0.92 }}>
                      {blockedAlert}
                    </div>
                  </div>
                </div>
              )}

              {/* Spring-animated Segmented Switcher between Login and Register */}
              {mode !== "forgot-password" && (
                <div className="sf-auth-segmented" role="tablist" aria-label="Authentication mode">
                  <div
                    className={`sf-auth-segmented-thumb ${mode === "register" ? "is-register" : ""}`}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "login"}
                    className={`sf-auth-segmented-btn ${mode === "login" ? "is-active" : ""}`}
                    onClick={() => switchMode("login")}
                  >
                    {ap.signIn}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "register"}
                    className={`sf-auth-segmented-btn ${mode === "register" ? "is-active" : ""}`}
                    onClick={() => switchMode("register")}
                  >
                    {ap.createAccount}
                  </button>
                </div>
              )}

              {/* Direction-aware animated view wrapper */}
              <div
                key={`${mode}-${animKey}`}
                className={`sf-auth-animated-body ${
                  animDir === "forward" ? "sf-auth-view-forward" : "sf-auth-view-backward"
                }`}
              >
                <header className="sf-auth-form-header">
                  <img
                    className="sf-auth-mark"
                    src="/assets/spacefarm-mark-violet.svg"
                    alt=""
                    width={54}
                    height={54}
                  />
                  <h2 id="auth-page-heading" tabIndex={-1}>
                    <span className="sf-sr-only">{heading}</span>
                    <span className="sf-auth-h2-sizer" aria-hidden="true">
                      <span className="sf-auth-h2-ghost">
                        {heading}
                        <span className="sf-typewriter-caret" />
                      </span>
                      <span className="sf-auth-h2-live">
                        <HeroTypewriter
                          words={[heading]}
                          fallback={heading}
                          loop={false}
                          typeSpeedMs={36}
                          textClassName="sf-auth-title-text"
                        />
                      </span>
                    </span>
                  </h2>
                  <p>{subtitle}</p>
                </header>

                {statusNotice && (
                  <p
                    className="sf-auth-status"
                    data-tone={statusNotice.tone}
                    role="status"
                    aria-live="polite"
                  >
                    {statusNotice.message}
                  </p>
                )}

                {mode !== "forgot-password" && registerStep === "form" && (
                  <>
                    {authProviders.google_enabled && !gsiFailed ? (
                      <div
                        ref={googleBtnHostRef}
                        style={{ display: "flex", justifyContent: "center", minHeight: 44, marginBottom: 4 }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="sf-auth-google-btn"
                        onClick={handleGoogleClick}
                      >
                        <svg viewBox="0 0 48 48" aria-hidden="true">
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
                          />
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.86 46.98 24.55Z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.79-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
                          />
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
                          />
                        </svg>
                        <span>{ap.google}</span>
                      </button>
                    )}

                    <div className="sf-auth-divider">
                      {mode === "register" ? ap.registerDivider : ap.emailDivider}
                    </div>
                  </>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  {mode === "register" && registerStep === "otp" && (
                    <div className="sf-auth-field" style={{ animationDelay: "0ms" }}>
                      <label className="sf-auth-field-label" htmlFor="auth-register-otp">
                        <MailCheck size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} aria-hidden="true" />
                        {ap.otpLabel}
                      </label>
                      <div className="sf-auth-input-shell">
                        <input
                          id="auth-register-otp"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{4}"
                          maxLength={4}
                          className="sf-auth-input"
                          style={{
                            textAlign: "center",
                            letterSpacing: "0.45em",
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: 22,
                            fontWeight: 700,
                          }}
                          value={otpCode}
                          onChange={(e) => {
                            setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 4));
                            setFieldErrors((p) => ({ ...p, otpCode: undefined }));
                          }}
                          placeholder="••••"
                          autoFocus
                          aria-invalid={Boolean(fieldErrors.otpCode)}
                        />
                      </div>
                      {fieldErrors.otpCode && (
                        <small className="sf-auth-field-error">{fieldErrors.otpCode}</small>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          marginTop: 10,
                          fontSize: 13,
                        }}
                      >
                        <button
                          type="button"
                          className="sf-auth-link-btn"
                          disabled={otpCooldown > 0 || isSubmitting}
                          onClick={handleResendOtp}
                          style={{ marginLeft: 0 }}
                        >
                          {otpCooldown > 0 ? `${ap.resendIn} ${otpCooldown}s` : ap.resendOtpBtn}
                        </button>
                        <button
                          type="button"
                          className="sf-auth-link-btn"
                          onClick={() => {
                            setRegisterStep("form");
                            setStatusNotice(null);
                          }}
                        >
                          {ap.changeDetailsBtn}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === "register" && registerStep === "form" && (
                    <div className="sf-auth-field" style={{ animationDelay: "0ms" }}>
                      <label className="sf-auth-field-label" htmlFor="auth-full-name">
                        {ap.fullName}
                      </label>
                      <div className="sf-auth-input-shell">
                        <input
                          id="auth-full-name"
                          type="text"
                          className="sf-auth-input"
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            setFieldErrors((p) => ({ ...p, fullName: undefined }));
                          }}
                          placeholder={ap.fullNamePlaceholder}
                          autoComplete="name"
                          maxLength={100}
                          aria-invalid={Boolean(fieldErrors.fullName)}
                        />
                      </div>
                      {fieldErrors.fullName && (
                        <small className="sf-auth-field-error">{fieldErrors.fullName}</small>
                      )}
                    </div>
                  )}

                  {mode === "register" && registerStep === "form" && (
                    <div className="sf-auth-field" style={{ animationDelay: "18ms" }}>
                      <label className="sf-auth-field-label" htmlFor="auth-region">
                        {locale === "az" ? "Əsas təsərrüfat bölgəsi" : "Primary agricultural region"}
                      </label>
                      <div className="sf-auth-input-shell">
                        <select
                          id="auth-region"
                          className="sf-auth-input"
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          style={{ cursor: "pointer" }}
                        >
                          <optgroup
                            label={locale === "az" ? "★ Əsas Bölgələr (4)" : "★ Primary Regions (4)"}
                            style={{ backgroundColor: "#0d0a1c", color: "#c4b5fd" }}
                          >
                            {VERIFIED_AZ_REGIONS.map((item) => {
                              const regionVal =
                                item.id === "ganja-dashkasan"
                                  ? "Ganja-Dashkasan"
                                  : item.id === "aran-barda"
                                    ? "Aran-Barda"
                                    : item.id === "quba-khachmaz"
                                      ? "Quba-Khachmaz"
                                      : "Sheki-Zaqatala";
                              return (
                                <option
                                  key={item.id}
                                  value={regionVal}
                                  style={{ backgroundColor: "#0d0a1c", color: "#f6f5fb" }}
                                >
                                  ★ {locale === "az" ? item.regionLabelAz : item.regionLabelEn}
                                </option>
                              );
                            })}
                          </optgroup>
                          <optgroup
                            label={
                              locale === "az"
                                ? `Bütün ${AZ_DISTRICTS.length} Rayon (A–Z)`
                                : `All ${AZ_DISTRICTS.length} Districts (A–Z)`
                            }
                            style={{ backgroundColor: "#0d0a1c", color: "#94a3b8" }}
                          >
                            {AZ_DISTRICTS.map((d) => (
                              <option
                                key={d.id}
                                value={locale === "az" ? d.nameAz : d.nameEn}
                                style={{ backgroundColor: "#0d0a1c", color: "#f6f5fb" }}
                              >
                                {locale === "az"
                                  ? `${d.nameAz} (${d.economicRegionAz})`
                                  : `${d.nameEn} (${d.economicRegionEn})`}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  )}

                  {(mode !== "register" || registerStep === "form") && (
                    <div className="sf-auth-field" style={{ animationDelay: "35ms" }}>
                      <label className="sf-auth-field-label" htmlFor="auth-email">
                        {ap.email}
                      </label>
                      <div className="sf-auth-input-shell">
                        <input
                          id="auth-email"
                          type="email"
                          className="sf-auth-input"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setFieldErrors((p) => ({ ...p, email: undefined }));
                          }}
                          placeholder="you@example.com"
                          autoComplete="email"
                          maxLength={254}
                          aria-invalid={Boolean(fieldErrors.email)}
                        />
                      </div>
                      {fieldErrors.email && (
                        <small className="sf-auth-field-error">{fieldErrors.email}</small>
                      )}
                    </div>
                  )}

                  {mode === "forgot-password" && resetStep === "request" && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                      <button
                        type="button"
                        className="sf-auth-link-btn"
                        style={{ fontSize: 13 }}
                        onClick={() => {
                          setResetStep("verify");
                          setStatusNotice(null);
                        }}
                      >
                        {ap.alreadyHaveResetCode}
                      </button>
                    </div>
                  )}

                  {mode === "forgot-password" && resetStep === "verify" && (
                    <>
                      <div className="sf-auth-field" style={{ animationDelay: "50ms" }}>
                        <label className="sf-auth-field-label" htmlFor="auth-reset-code">
                          <KeyRound size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} aria-hidden="true" />
                          {ap.resetCodeLabel}
                        </label>
                        <div className="sf-auth-input-shell">
                          <input
                            id="auth-reset-code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            className="sf-auth-input"
                            style={{
                              letterSpacing: "0.35em",
                              fontFamily: "var(--font-mono, monospace)",
                              fontWeight: 700,
                            }}
                            value={resetCode}
                            onChange={(e) => {
                              setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                              setFieldErrors((p) => ({ ...p, resetCode: undefined }));
                            }}
                            placeholder={ap.resetCodePlaceholder}
                            aria-invalid={Boolean(fieldErrors.resetCode)}
                          />
                        </div>
                        {fieldErrors.resetCode && (
                          <small className="sf-auth-field-error">{fieldErrors.resetCode}</small>
                        )}
                      </div>

                      <div className="sf-auth-field" style={{ animationDelay: "70ms" }}>
                        <label className="sf-auth-field-label" htmlFor="auth-new-password">
                          {ap.newPasswordLabel}
                        </label>
                        <div className="sf-auth-input-shell">
                          <input
                            id="auth-new-password"
                            type={showPassword ? "text" : "password"}
                            className="sf-auth-input has-toggle"
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              setFieldErrors((p) => ({ ...p, newPassword: undefined }));
                            }}
                            placeholder={ap.newPasswordPlaceholder}
                            autoComplete="new-password"
                            maxLength={128}
                            aria-invalid={Boolean(fieldErrors.newPassword)}
                          />
                          <button
                            type="button"
                            className="sf-auth-pwd-toggle"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? ap.hidePassword : ap.showPassword}
                            aria-pressed={showPassword}
                          >
                            {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                          </button>
                        </div>
                        {fieldErrors.newPassword && (
                          <small className="sf-auth-field-error">{fieldErrors.newPassword}</small>
                        )}
                      </div>
                    </>
                  )}

                  {mode !== "forgot-password" && (mode !== "register" || registerStep === "form") && (
                    <div className="sf-auth-field" style={{ animationDelay: "70ms" }}>
                      <label className="sf-auth-field-label" htmlFor="auth-password">
                        {ap.password}
                      </label>
                      <div className="sf-auth-input-shell">
                        <input
                          id="auth-password"
                          type={showPassword ? "text" : "password"}
                          className="sf-auth-input has-toggle"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setFieldErrors((p) => ({ ...p, password: undefined }));
                          }}
                          placeholder={
                            mode === "register" ? ap.createPassword : ap.passwordPlaceholder
                          }
                          autoComplete={
                            mode === "register" ? "new-password" : "current-password"
                          }
                          maxLength={128}
                          aria-invalid={Boolean(fieldErrors.password)}
                        />
                        <button
                          type="button"
                          className="sf-auth-pwd-toggle"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? ap.hidePassword : ap.showPassword}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? (
                            <EyeOff size={20} aria-hidden="true" />
                          ) : (
                            <Eye size={20} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      {mode === "register" && !fieldErrors.password && (
                        <small className="sf-auth-field-hint">{ap.passwordHint}</small>
                      )}
                      {fieldErrors.password && (
                        <small className="sf-auth-field-error">{fieldErrors.password}</small>
                      )}
                    </div>
                  )}

                  {mode === "login" && (
                    <div className="sf-auth-options">
                      <label className="sf-auth-checkbox">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <span>{ap.remember}</span>
                      </label>

                      <button
                        type="button"
                        className="sf-auth-link-btn"
                        onClick={() => switchMode("forgot-password")}
                      >
                        {ap.forgot}
                      </button>
                    </div>
                  )}

                  {mode === "register" && registerStep === "form" && (
                    <div className="sf-auth-terms-row">
                      <label className="sf-auth-checkbox">
                        <input
                          type="checkbox"
                          checked={agreedTerms}
                          onChange={(e) => {
                            setAgreedTerms(e.target.checked);
                            setFieldErrors((p) => ({ ...p, agreement: undefined }));
                          }}
                          aria-invalid={Boolean(fieldErrors.agreement)}
                        />
                        <span>
                          {ap.agreementBefore}{" "}
                          <button
                            type="button"
                            className="sf-auth-link-btn"
                            onClick={() => setPolicyModal("terms")}
                          >
                            {ap.termsOfService}
                          </button>{" "}
                          {ap.and}{" "}
                          <button
                            type="button"
                            className="sf-auth-link-btn"
                            onClick={() => setPolicyModal("privacy")}
                          >
                            {ap.privacyPolicy}
                          </button>{" "}
                          {ap.agreementAfter}
                        </span>
                      </label>
                      {fieldErrors.agreement && (
                        <small className="sf-auth-field-error">{fieldErrors.agreement}</small>
                      )}
                    </div>
                  )}

                  <button type="submit" className="sf-auth-primary-btn" disabled={isSubmitting}>
                    <span>
                      {mode === "forgot-password"
                        ? resetStep === "verify"
                          ? ap.verifyResetBtn
                          : ap.sendReset
                        : mode === "register"
                          ? registerStep === "otp"
                            ? ap.verifyOtpBtn
                            : ap.createAccount
                          : ap.signIn}
                    </span>
                    <svg
                      className="sf-auth-arrow"
                      viewBox="0 0 24 24"
                      width={21}
                      height={21}
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 12h16m-6-6 6 6-6 6"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </form>

                <p className="sf-auth-switch-row">
                  {mode === "forgot-password" ? (
                    <button
                      type="button"
                      className="sf-auth-link-btn"
                      onClick={() => switchMode("login")}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 0 }}
                    >
                      <ArrowLeft size={15} aria-hidden="true" />
                      <span>{ap.backToSignIn}</span>
                    </button>
                  ) : (
                    <>
                      <span>{mode === "register" ? ap.alreadyAccount : ap.newHere}</span>
                      <button
                        type="button"
                        className="sf-auth-link-btn"
                        onClick={() => switchMode(mode === "register" ? "login" : "register")}
                      >
                        {mode === "register" ? ap.signIn : ap.createLink}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <footer className="sf-auth-footer">
            <button
              type="button"
              className="sf-auth-link-btn"
              style={{ color: "#beb7cf", fontSize: 12 }}
              onClick={() => setPolicyModal("privacy")}
            >
              {ap.privacy}
            </button>
            <span className="sf-auth-footer-sep" aria-hidden="true" />
            <button
              type="button"
              className="sf-auth-link-btn"
              style={{ color: "#beb7cf", fontSize: 12 }}
              onClick={() => setPolicyModal("terms")}
            >
              {ap.terms}
            </button>
            <span className="sf-auth-footer-sep" aria-hidden="true" />
            <span>© 2026 SpaceFarm</span>
          </footer>
        </section>
      </main>

      {/* Policy Dialog matching SpaceFarm-Auth */}
      {policyModal && (
        <div
          className="sf-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPolicyModal(null);
          }}
        >
          <div
            className="sf-modal sf-profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-policy-title"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <img src="/assets/spacefarm-mark-violet.svg" alt="" width={40} height={40} />
              <button
                type="button"
                className="sf-btn sf-btn-sm"
                onClick={() => setPolicyModal(null)}
                aria-label={t.actions.close}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <h2 id="auth-policy-title" className="sf-section-title">
              {policyModal === "privacy" ? ap.privacyPolicy : ap.termsOfService}
            </h2>
            <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.65 }}>
              {policyModal === "privacy" ? ap.privacyBody : ap.termsBody}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="sf-btn sf-btn-sm sf-btn-primary"
                onClick={() => setPolicyModal(null)}
              >
                {ap.understood}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
