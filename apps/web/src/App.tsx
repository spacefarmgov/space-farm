import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
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
  const { user, t, triggerAuthAlert } = useSpaceFarm();
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      triggerAuthAlert(location.pathname || "/explore");
    }
  }, [user, location.pathname, triggerAuthAlert]);

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          alertMessage: t.auth.alertRequiredBody,
          redirectTo: location.pathname || "/explore",
        }}
      />
    );
  }

  return <>{children}</>;
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
      </SpaceFarmProvider>
    </BrowserRouter>
  );
}
