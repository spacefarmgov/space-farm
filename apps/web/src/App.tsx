import { useEffect, useState } from "react";
import { getHealth } from "./api/client";
import type { HealthResponse } from "./api/types";

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(setHealth)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to reach Space Farm API");
      });
    return () => controller.abort();
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Space Farm — Team CODE44 (Foundation Shell)</h1>
      <p>Frontend workspace skeleton connected to frozen API contract <code>v0.1.0</code>.</p>
      {health ? (
        <pre style={{ background: "#f4f6f8", padding: "1rem", borderRadius: 8 }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      ) : error ? (
        <p style={{ color: "#b91c1c" }}>API status error: {error}</p>
      ) : (
        <p>Checking backend health...</p>
      )}
    </main>
  );
}
