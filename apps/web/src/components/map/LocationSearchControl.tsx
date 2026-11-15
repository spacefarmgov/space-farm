import React, { useEffect, useId, useRef, useState } from "react";
import { Globe2, Loader2, MapPin, Search, X } from "lucide-react";
import {
  foldSearchText,
  formatLatLon,
  parseCoordinateOrMapLink,
  searchGlobalLocations,
  searchLocalAzDistricts,
  type GlobalGeocodeResult,
} from "../../utils/locationSearch";

export interface LocationSearchSelection {
  lat: number;
  lon: number;
  label: string;
  presetId?: string | null;
  exactCoords?: boolean;
  source:
    | "coords"
    | "dms"
    | "maps_url"
    | "osm_url"
    | "geo_uri"
    | "az_district"
    | "open_meteo"
    | "google_maps_link";
}

export interface LocationSearchControlProps {
  language: "en" | "az";
  apiBaseUrl?: string;
  variant?: "hud" | "panel";
  className?: string;
  onSelectLocation: (selection: LocationSearchSelection) => void;
}

export const LocationSearchControl: React.FC<LocationSearchControlProps> = ({
  language,
  apiBaseUrl,
  variant = "hud",
  className = "",
  onSelectLocation,
}) => {
  const isAz = language === "az";
  const inputId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const resultsQueryRef = useRef<string>("");
  const suppressNextSearchRef = useRef(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalGeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [statusNote, setStatusNote] = useState<{
    tone: "error" | "ok" | "info";
    text: string;
  } | null>(null);

  const parsedNow = query.trim() ? parseCoordinateOrMapLink(query) : null;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (statusNote?.tone !== "ok") return;
    const t = window.setTimeout(() => setStatusNote(null), 3200);
    return () => window.clearTimeout(t);
  }, [statusNote]);

  useEffect(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      resultsQueryRef.current = "";
      setResults([]);
      setActiveIndex(-1);
      setLoading(false);
      setOpen(false);
      setStatusNote(null);
      return;
    }

    const parsed = parseCoordinateOrMapLink(trimmed);
    if (parsed.kind === "coordinates") {
      abortRef.current?.abort();
      resultsQueryRef.current = "";
      setLoading(false);
      setResults([]);
      setActiveIndex(-1);
      setStatusNote(null);
      return;
    }
    if (parsed.kind === "invalid") {
      abortRef.current?.abort();
      resultsQueryRef.current = "";
      setLoading(false);
      setResults([]);
      setActiveIndex(-1);
      setStatusNote({
        tone: "error",
        text:
          parsed.reason === "out_of_range"
            ? isAz
              ? "Koordinat diapazonu yanlışdır (-90..90, -180..180)"
              : "Coordinates out of range (-90..90, -180..180)"
            : isAz
              ? "Keçərli xəritə linki və ya koordinat daxil edin"
              : "Enter a valid map URL or coordinates",
      });
      return;
    }
    if (parsed.kind === "short_url") {
      abortRef.current?.abort();
      resultsQueryRef.current = "";
      setResults([]);
      setActiveIndex(-1);
      setStatusNote(null);
      return;
    }

    const searchStr = parsed.query;
    const qFold = foldSearchText(searchStr);
    if (qFold.length < 2) {
      resultsQueryRef.current = "";
      setResults([]);
      setActiveIndex(-1);
      setLoading(false);
      return;
    }

    // Show instant AZ hints ONLY while debouncing, without pre-selecting index 0
    // so fast Enter still resolves against full global geocoding.
    const instantAz = searchLocalAzDistricts(searchStr, 4);
    if (instantAz.length > 0) {
      resultsQueryRef.current = "__preliminary__";
      setResults(instantAz);
      setActiveIndex(-1);
      setOpen(true);
    } else if (resultsQueryRef.current !== qFold) {
      resultsQueryRef.current = "";
      setResults([]);
      setActiveIndex(-1);
    }

    const timer = window.setTimeout(async () => {
      debounceTimerRef.current = null;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setStatusNote(null);
      try {
        const res = await searchGlobalLocations(searchStr, apiBaseUrl, ctrl.signal);
        if (ctrl.signal.aborted) return;
        resultsQueryRef.current = qFold;
        setResults(res.results);
        setActiveIndex(res.results.length > 0 ? 0 : -1);
        setOpen(true);
        if (res.results.length === 0) {
          setStatusNote({
            tone: "info",
            text: isAz
              ? "Məkan tapılmadı — şəhər, koordinat və ya Maps linki yazın"
              : "No match — try city name, lat,lng, or Maps link",
          });
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      }
    }, 280);
    debounceTimerRef.current = timer;

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [query, apiBaseUrl, isAz]);

  function commitSelection(sel: LocationSearchSelection) {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    abortRef.current?.abort();
    resultsQueryRef.current = "";
    setLoading(false);
    onSelectLocation(sel);
    setOpen(false);
    setResults([]);
    setActiveIndex(-1);
    setStatusNote({
      tone: "ok",
      text: `${sel.label} (${formatLatLon(sel.lat, sel.lon, 3)})`,
    });
  }

  function handleSelectResult(item: GlobalGeocodeResult) {
    const placeName = isAz && item.nameAz ? item.nameAz : item.name;
    const countryPart = item.country && item.source !== "az_district" ? `, ${item.country}` : "";
    const label = `${placeName}${countryPart}`;
    commitSelection({
      lat: item.lat,
      lon: item.lon,
      label,
      presetId: item.presetId ?? null,
      exactCoords: item.source !== "az_district",
      source: item.source,
    });
    if (placeName !== query) {
      suppressNextSearchRef.current = true;
      setQuery(placeName);
    }
  }

  async function resolveAndCommitInput(raw: string, fromAutoPaste = false) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const parsed = parseCoordinateOrMapLink(trimmed);

    if (parsed.kind === "coordinates") {
      const displayLabel = parsed.label ?? formatLatLon(parsed.lat, parsed.lon, 3);
      commitSelection({
        lat: parsed.lat,
        lon: parsed.lon,
        label: displayLabel,
        presetId: null,
        exactCoords: true,
        source: parsed.source,
      });
      return;
    }

    if (parsed.kind === "invalid") {
      setStatusNote({
        tone: "error",
        text:
          parsed.reason === "out_of_range"
            ? isAz
              ? "Koordinat diapazonu yanlışdır (-90..90, -180..180)"
              : "Coordinates out of range (-90..90, -180..180)"
            : isAz
              ? "Xəritə linkindən koordinat oxunmadı"
              : "Could not read coordinates from this URL",
      });
      return;
    }

    if (parsed.kind === "short_url") {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setStatusNote({
        tone: "info",
        text: isAz ? "Google Maps linki açılır..." : "Resolving Google Maps link...",
      });
      try {
        const res = await searchGlobalLocations(parsed.url, apiBaseUrl, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (res.results.length > 0) {
          handleSelectResult(res.results[0]);
        } else {
          setStatusNote({
            tone: "error",
            text: isAz
              ? "Qısa linkdən koordinat tapılmadı — tam Maps URL və ya lat,lon yapışdırın"
              : "No coordinates found in short link — paste full Maps URL or lat,lon",
          });
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setStatusNote({
          tone: "error",
          text: isAz
            ? "Qısa Maps linki açıla bilmədi"
            : "Could not expand short Google Maps link",
        });
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
      return;
    }

    // Place query submitted via Enter / Go button (do not auto-jump on plain text paste unless Enter)
    if (fromAutoPaste) return;

    const cleanQ = parsed.query;
    const cleanFold = foldSearchText(cleanQ);
    if (cleanFold.length < 2) return;

    // Commit immediately only when user explicitly selected an item via arrow keys
    // or when results have already resolved for this exact query.
    if (activeIndex >= 0 && results[activeIndex]) {
      handleSelectResult(results[activeIndex]);
      return;
    }
    if (resultsQueryRef.current === cleanFold && results.length > 0) {
      handleSelectResult(results[0]);
      return;
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await searchGlobalLocations(cleanQ, apiBaseUrl, ctrl.signal);
      if (ctrl.signal.aborted) return;
      resultsQueryRef.current = cleanFold;
      const top = res.results[0];
      const topExactMatch =
        top &&
        (foldSearchText(top.name) === cleanFold ||
          (top.nameAz ? foldSearchText(top.nameAz) === cleanFold : false));
      if (res.results.length === 1 || topExactMatch) {
        handleSelectResult(top);
      } else {
        setResults(res.results);
        setActiveIndex(res.results.length > 0 ? 0 : -1);
        setOpen(true);
        if (res.results.length === 0) {
          setStatusNote({
            tone: "info",
            text: isAz
              ? "Məkan tapılmadı — şəhər, koordinat və ya Maps linki yazın"
              : "No match — try city name, lat,lng, or Maps link",
          });
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setStatusNote({
          tone: "error",
          text: isAz ? "Axtarış xətası baş verdi" : "Search failed — check connection",
        });
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData?.getData("text");
    if (!pasted) return;
    const parsed = parseCoordinateOrMapLink(pasted);
    if (parsed.kind === "coordinates" || parsed.kind === "short_url") {
      // Populate input smoothly and immediately locate the pasted spot
      window.setTimeout(() => {
        void resolveAndCommitInput(pasted, true);
      }, 20);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void resolveAndCommitInput(query, false);
    }
  }

  const showInstantCoordOption = parsedNow?.kind === "coordinates";
  const showShortUrlOption = parsedNow?.kind === "short_url";
  const showDropdown =
    open && (results.length > 0 || showInstantCoordOption || showShortUrlOption);

  return (
    <div
      ref={rootRef}
      className={`sf-loc-search sf-loc-search--${variant} ${className}`.trim()}
    >
      <div className="sf-loc-search-bar">
        <Search className="sf-loc-search-icon" size={14} aria-hidden="true" />
        <label htmlFor={inputId} className="sf-sr-only">
          {isAz
            ? "Məkan axtar, koordinat və ya Maps linki yapışdır"
            : "Search location, paste coordinates or Maps link"}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className="sf-loc-search-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            const p = parseCoordinateOrMapLink(e.target.value);
            if (p.kind === "coordinates" || p.kind === "short_url") {
              setOpen(true);
            }
          }}
          onFocus={() => {
            if (results.length > 0 || showInstantCoordOption || showShortUrlOption) {
              setOpen(true);
            }
          }}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={
            isAz
              ? "Şəhər, koordinat (40.40, 49.86) və ya Maps linki..."
              : "Search city, paste lat,lng or Maps link..."
          }
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
        />
        {loading && (
          <Loader2
            size={14}
            className="sf-loc-search-spinner"
            aria-label={isAz ? "Axtarılır" : "Searching"}
          />
        )}
        {query && !loading && (
          <button
            type="button"
            className="sf-loc-search-clear"
            onClick={() => {
              resultsQueryRef.current = "";
              setQuery("");
              setResults([]);
              setActiveIndex(-1);
              setOpen(false);
              setStatusNote(null);
              inputRef.current?.focus();
            }}
            aria-label={isAz ? "Axtarışı təmizlə" : "Clear search"}
          >
            <X size={13} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="sf-loc-search-go"
          onClick={() => void resolveAndCommitInput(query, false)}
          aria-label={isAz ? "Konuma get" : "Go to location"}
        >
          {isAz ? "Get" : "Go"}
        </button>
      </div>

      {statusNote && !showDropdown && (
        <div
          className={`sf-loc-search-note is-${statusNote.tone}`}
          role={statusNote.tone === "error" ? "alert" : "status"}
        >
          {statusNote.text}
        </div>
      )}

      {showDropdown && (
        <ul id={listboxId} role="listbox" className="sf-loc-search-dropdown">
          {parsedNow?.kind === "coordinates" && (
            <li role="option" aria-selected={true}>
              <button
                type="button"
                className="sf-loc-search-item is-active"
                onClick={() => void resolveAndCommitInput(query, false)}
              >
                <MapPin size={14} className="sf-loc-item-icon is-pin" aria-hidden="true" />
                <div className="sf-loc-item-body">
                  <strong>
                    {parsedNow.label ??
                      (isAz ? "Dəqiq koordinata keç" : "Jump to exact coordinates")}
                  </strong>
                  <span>{formatLatLon(parsedNow.lat, parsedNow.lon, 4)}</span>
                </div>
                <span className="sf-loc-item-badge">
                  {parsedNow.source === "maps_url" || parsedNow.source === "osm_url"
                    ? "MAPS"
                    : parsedNow.source === "dms"
                      ? "DMS"
                      : "GPS"}
                </span>
              </button>
            </li>
          )}

          {parsedNow?.kind === "short_url" && (
            <li role="option" aria-selected={true}>
              <button
                type="button"
                className="sf-loc-search-item is-active"
                onClick={() => void resolveAndCommitInput(query, false)}
              >
                <MapPin size={14} className="sf-loc-item-icon is-pin" aria-hidden="true" />
                <div className="sf-loc-item-body">
                  <strong>
                    {isAz ? "Google Maps linkini aç və göstər" : "Resolve Google Maps share link"}
                  </strong>
                  <span>{parsedNow.url}</span>
                </div>
                <span className="sf-loc-item-badge">URL</span>
              </button>
            </li>
          )}

          {results.map((item, idx) => {
            const nameStr = isAz && item.nameAz ? item.nameAz : item.name;
            const subParts = [
              isAz && item.admin1Az ? item.admin1Az : item.admin1,
              item.country,
              typeof item.elevationM === "number" ? `${Math.round(item.elevationM)} m` : null,
            ].filter(Boolean);
            return (
              <li key={item.id} role="option" aria-selected={idx === activeIndex}>
                <button
                  type="button"
                  className={`sf-loc-search-item ${idx === activeIndex ? "is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelectResult(item)}
                >
                  {item.source === "az_district" ? (
                    <MapPin size={14} className="sf-loc-item-icon is-az" aria-hidden="true" />
                  ) : (
                    <Globe2 size={14} className="sf-loc-item-icon" aria-hidden="true" />
                  )}
                  <div className="sf-loc-item-body">
                    <strong>{nameStr}</strong>
                    <span>
                      {subParts.join(" · ")} ({formatLatLon(item.lat, item.lon, 2)})
                    </span>
                  </div>
                  <span className="sf-loc-item-badge">
                    {item.source === "az_district"
                      ? "★ AZ"
                      : item.countryCode ?? "GLOBAL"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
