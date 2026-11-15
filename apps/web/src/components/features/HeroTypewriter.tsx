import { useEffect, useState } from "react";

interface HeroTypewriterProps {
  words: string[];
  fallback: string;
  loop?: boolean;
  typeSpeedMs?: number;
  textClassName?: string;
}

/**
 * Smooth cosmic typewriter accent for headlines.
 * Keeps screen-reader pronunciation handled by parent `.sf-sr-only` text
 * and falls back to the full static phrase under `prefers-reduced-motion`.
 */
export function HeroTypewriter({
  words,
  fallback,
  loop = true,
  typeSpeedMs = 58,
  textClassName = "sf-typewriter-text",
}: HeroTypewriterProps) {
  const safeWords = words.length > 0 ? words : [fallback];
  const [wordIndex, setWordIndex] = useState(0);
  const [charCount, setCharCount] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  // Sync reduced-motion preference dynamically
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Reset cleanly when locale or cycle list changes
  const wordsSignature = `${safeWords.join("|")}:${loop ? "loop" : "once"}`;
  useEffect(() => {
    setWordIndex(0);
    setCharCount(1);
    setIsDeleting(false);
  }, [wordsSignature]);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const currentWord = safeWords[wordIndex % safeWords.length] || fallback;
    if (!loop && !isDeleting && charCount >= currentWord.length) {
      return;
    }

    let delay = typeSpeedMs;

    if (!isDeleting && charCount < currentWord.length) {
      delay = typeSpeedMs;
    } else if (!isDeleting && charCount >= currentWord.length) {
      delay = 2500;
    } else if (isDeleting && charCount > 0) {
      delay = 32;
    } else {
      delay = 240;
    }

    const timer = window.setTimeout(() => {
      if (!isDeleting && charCount < currentWord.length) {
        setCharCount((c) => c + 1);
      } else if (!isDeleting && charCount >= currentWord.length) {
        setIsDeleting(true);
      } else if (isDeleting && charCount > 0) {
        setCharCount((c) => c - 1);
      } else {
        setIsDeleting(false);
        setWordIndex((idx) => (idx + 1) % safeWords.length);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [charCount, fallback, isDeleting, loop, reduceMotion, safeWords, typeSpeedMs, wordIndex]);

  const currentWord = safeWords[wordIndex % safeWords.length] || fallback;
  const visibleText = reduceMotion ? fallback : currentWord.slice(0, charCount);

  return (
    <span className="sf-hero-h1-accent sf-typewriter-wrap">
      <span className={textClassName}>{visibleText || "\u200B"}</span>
      {!reduceMotion && <span className="sf-typewriter-caret" aria-hidden="true" />}
    </span>
  );
}
