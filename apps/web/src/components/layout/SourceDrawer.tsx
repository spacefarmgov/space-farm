import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useSpaceFarm } from "../../context/SpaceFarmContext";
import { ProvenanceCards } from "../features/sources/ProvenanceCards";

export function SourceDrawer() {
  const {
    t,
    sourceDrawerOpen,
    sourceDrawerSection,
    closeSourceDrawer,
  } = useSpaceFarm();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (sourceDrawerOpen) {
      openerRef.current = document.activeElement as HTMLElement | null;
      window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    } else if (openerRef.current) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [sourceDrawerOpen]);

  useEffect(() => {
    if (!sourceDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSourceDrawer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sourceDrawerOpen, closeSourceDrawer]);

  if (!sourceDrawerOpen || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="sf-drawer-backdrop"
        onClick={closeSourceDrawer}
        aria-hidden="true"
      />
      <aside
        className="sf-source-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t.sources.provenanceCardsTitle}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <h2 style={{ fontSize: 20 }}>{t.sources.provenanceCardsTitle}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="sf-btn sf-btn-sm"
            onClick={closeSourceDrawer}
            aria-label={t.actions.close}
          >
            <X size={16} aria-hidden="true" />
            <span>{t.actions.close}</span>
          </button>
        </div>

        <ProvenanceCards focusedSection={sourceDrawerSection} compact />
      </aside>
    </>,
    document.body,
  );
}

export function MethodologyModal() {
  const { methodologyOpen, closeMethodology, t } = useSpaceFarm();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (methodologyOpen) {
      prevFocusRef.current = document.activeElement as HTMLElement | null;
      window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    } else if (prevFocusRef.current) {
      prevFocusRef.current.focus();
      prevFocusRef.current = null;
    }
  }, [methodologyOpen]);

  useEffect(() => {
    if (!methodologyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMethodology();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [methodologyOpen, closeMethodology]);

  if (!methodologyOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="sf-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeMethodology();
      }}
    >
      <div
        className="sf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-methodology-heading"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 id="sf-methodology-heading" style={{ fontSize: 20 }}>
            {t.sources.methodologyModalTitle}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="sf-btn sf-btn-sm"
            onClick={closeMethodology}
            aria-label={t.actions.close}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {t.sources.methodologyParagraphs.map((p, idx) => (
            <p key={idx} style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
