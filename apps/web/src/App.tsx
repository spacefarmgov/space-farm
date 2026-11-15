import { Component, Suspense, lazy, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { SpaceFarmProvider, useSpaceFarm } from "./context/SpaceFarmContext";
import {
  SpaceFarmBootCurtain,
  SpaceFarmLoader,
  SpaceFarmRouteBar,
} from "./components/ui/SpaceFarmLoader";
import { HomePage } from "./pages/HomePage";

// Route-level code splitting so Orbital Explorer / Leaflet do not block Home hero render
const OrbitalExplorerPage = lazy(() =>
  import("./pages/OrbitalExplorerPage").then((m) => ({ default: m.OrbitalExplorerPage })),
);
const FieldIntelligencePage = lazy(() =>
  import("./pages/FieldIntelligencePage").then((m) => ({ default: m.FieldIntelligencePage })),
);
const ClimateHistoryPage = lazy(() =>
  import("./pages/ClimateHistoryPage").then((m) => ({ default: m.ClimateHistoryPage })),
);
const RotationStudioPage = lazy(() =>
  import("./pages/RotationStudioPage").then((m) => ({ default: m.RotationStudioPage })),
);
const ScenarioLabPage = lazy(() =>
  import("./pages/ScenarioLabPage").then((m) => ({ default: m.ScenarioLabPage })),
);
const SourcesExplanationsPage = lazy(() =>
  import("./pages/SourcesExplanationsPage").then((m) => ({ default: m.SourcesExplanationsPage })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const SpaceFarmAiPage = lazy(() =>
  import("./pages/SpaceFarmAiPage").then((m) => ({ default: m.SpaceFarmAiPage })),
);
const RiskAlertsPage = lazy(() =>
  import("./pages/RiskAlertsPage").then((m) => ({ default: m.RiskAlertsPage })),
);
const AuthPage = lazy(() =>
  import("./pages/AuthPage").then((m) => ({ default: m.AuthPage })),
);

class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Unexpected interface error." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("SpaceFarm route boundary caught:", error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "var(--bg-void, #05050b)",
            color: "var(--text-primary, #f6f5fb)",
          }}
        >
          <div className="sf-panel" style={{ maxWidth: 460, textAlign: "center" }}>
            <h2 style={{ marginTop: 0 }}>SpaceFarm View Reloaded</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              {this.state.message}
            </p>
            <button
              type="button"
              className="sf-btn sf-btn-primary"
              onClick={() => {
                this.setState({ hasError: false, message: "" });
                window.location.reload();
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteFallback() {
  return <SpaceFarmLoader variant="route" />;
}

function ScrollToTopOnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, t, loginAsDemoJudge } = useSpaceFarm();
  const navigate = useNavigate();
  const bootRequestedRef = useRef(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (user || bootRequestedRef.current) return;
    bootRequestedRef.current = true;
    void loginAsDemoJudge().then((res) => {
      if (!res.ok) {
        setBootError(res.error ?? t.errors.apiUnreachableTitle);
      }
    });
  }, [user, loginAsDemoJudge, t.errors.apiUnreachableTitle]);

  if (user) {
    return <>{children}</>;
  }

  if (bootError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "var(--bg-void, #05050b)",
          color: "var(--text-primary, #f6f5fb)",
        }}
      >
        <div className="sf-panel" style={{ maxWidth: 460, textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>{t.errors.apiUnreachableTitle}</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{bootError}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="sf-btn sf-btn-primary"
              onClick={() => {
                setBootError(null);
                bootRequestedRef.current = true;
                void loginAsDemoJudge().then((res) => {
                  if (!res.ok) {
                    setBootError(res.error ?? t.errors.apiUnreachableTitle);
                  }
                });
              }}
            >
              {t.actions.retry}
            </button>
            <button
              type="button"
              className="sf-btn"
              onClick={() => navigate("/login")}
            >
              {t.nav.login}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <SpaceFarmLoader variant="route" />;
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <SpaceFarmProvider>
        <SpaceFarmBootCurtain />
        <SpaceFarmRouteBar />
        <ScrollToTopOnNavigate />
        <RouteErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route path="/register" element={<AuthPage initialMode="register" />} />
            <Route path="/forgot-password" element={<AuthPage initialMode="forgot-password" />} />
            <Route
              path="/explore"
              element={
                <ProtectedRoute>
                  <OrbitalExplorerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/field"
              element={
                <ProtectedRoute>
                  <FieldIntelligencePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/climate"
              element={
                <ProtectedRoute>
                  <ClimateHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rotation"
              element={
                <ProtectedRoute>
                  <RotationStudioPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scenarios"
              element={
                <ProtectedRoute>
                  <ScenarioLabPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <RiskAlertsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sources"
              element={
                <ProtectedRoute>
                  <SourcesExplanationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai"
              element={
                <ProtectedRoute>
                  <SpaceFarmAiPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </SpaceFarmProvider>
    </BrowserRouter>
  );
}
