import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bot,
  Camera,
  Check,
  MapPin,
  Plus,
  Save,
  Sprout,
  Trash2,
  X,
} from "lucide-react";
import { VERIFIED_AZ_REGIONS } from "../data/regions";
import { AZ_DISTRICTS, findAzDistrict } from "../data/azDistricts";
import { AppShell } from "../components/layout/AppShell";
import { useSpaceFarm } from "../context/SpaceFarmContext";
import type { IrrigationType, SoilTexture } from "../api/types";

const PHONE_CODES = ["AZ +994", "TR +90", "GE +995", "DE +49", "US +1"];

export function ProfilePage() {
  const {
    locale,
    t,
    user,
    userProfile,
    parcels,
    updateProfile,
    addParcel,
    setActiveParcel,
    removeParcel,
    showToast,
  } = useSpaceFarm();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const p = t.profilePage;

  // Profile form state synced cleanly from SQLite userProfile
  const [name, setName] = useState(userProfile?.name ?? user?.name ?? "");
  const [username, setUsername] = useState(userProfile?.username ?? "");
  const [phoneCode, setPhoneCode] = useState(userProfile?.phone_code ?? "AZ +994");
  const [phone, setPhone] = useState(userProfile?.phone ?? "");
  const [activeSince, setActiveSince] = useState(userProfile?.active_since ?? "2024-01-01");
  const [region, setRegion] = useState(userProfile?.region ?? user?.region ?? "Ganja-Dashkasan");
  const [email, setEmail] = useState(userProfile?.email ?? user?.email ?? "");
  const [roleType, setRoleType] = useState<
    "farmer" | "agronomist" | "cooperative" | "researcher"
  >(userProfile?.role_type ?? "farmer");
  const [irrigationPref, setIrrigationPref] = useState<"irrigated" | "rainfed" | "hybrid">(
    userProfile?.irrigation_pref ?? "irrigated",
  );
  const [bio, setBio] = useState(userProfile?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    userProfile?.avatar_data_url ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New parcel drawer state
  const [showAddParcel, setShowAddParcel] = useState(false);
  const [parcelLabel, setParcelLabel] = useState("");
  const [parcelRegionId, setParcelRegionId] = useState("ganja-dashkasan");
  const [parcelLat, setParcelLat] = useState("40.68");
  const [parcelLon, setParcelLon] = useState("46.36");
  const [parcelArea, setParcelArea] = useState("25");
  const [parcelIrrigation, setParcelIrrigation] = useState<IrrigationType>("irrigated");
  const [parcelPh, setParcelPh] = useState("6.8");
  const [parcelTexture, setParcelTexture] = useState<SoilTexture>("loam");
  const [parcelCrop, setParcelCrop] = useState("wheat");
  const [addingParcel, setAddingParcel] = useState(false);
  const [parcelError, setParcelError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    setName(userProfile.name);
    setUsername(userProfile.username);
    setPhoneCode(userProfile.phone_code || "AZ +994");
    setPhone(userProfile.phone);
    setActiveSince(userProfile.active_since || "2024-01-01");
    setRegion(userProfile.region || "Ganja-Dashkasan");
    setEmail(userProfile.email);
    setRoleType(userProfile.role_type);
    setIrrigationPref(userProfile.irrigation_pref);
    setBio(userProfile.bio);
    setAvatarUrl(userProfile.avatar_data_url);
  }, [userProfile]);

  const initials = (name || email || "SF")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  function handleAvatarSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        setAvatarUrl(canvas.toDataURL("image/jpeg", 0.85));
      };
      if (typeof reader.result === "string") {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    if (name.trim().length < 2) {
      setFormError(t.auth.shortName);
      return;
    }
    if (!email.trim().includes("@")) {
      setFormError(t.auth.invalidEmail);
      return;
    }
    setSaving(true);
    const res = await updateProfile({
      name: name.trim(),
      username: username.trim(),
      phone_code: phoneCode,
      phone: phone.trim(),
      active_since: activeSince,
      region: region.trim() || "Ganja-Dashkasan",
      email: email.trim().toLowerCase(),
      role_type: roleType,
      irrigation_pref: irrigationPref,
      bio,
      avatar_data_url: avatarUrl,
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? "Failed to update profile");
    }
  }

  function handlePresetSelect(regId: string) {
    setParcelRegionId(regId);
    const match = VERIFIED_AZ_REGIONS.find((r) => r.id === regId);
    if (match) {
      setParcelLat(String(match.latitude));
      setParcelLon(String(match.longitude));
      setParcelArea(String(match.areaHa));
      setParcelIrrigation(match.irrigationType);
      setParcelCrop(match.priorCropId);
      setParcelPh(match.ph !== null ? String(match.ph) : "");
      setParcelTexture(match.texture);
      if (!parcelLabel.trim()) {
        setParcelLabel(locale === "az" ? match.nameAz : match.nameEn);
      }
      return;
    }
    const dist = findAzDistrict(regId);
    if (!dist) return;
    setParcelLat(String(dist.lat));
    setParcelLon(String(dist.lon));
    setParcelArea("25");
    setParcelIrrigation(dist.irrigation);
    setParcelCrop("wheat");
    setParcelPh(String(dist.defaultPh));
    setParcelTexture(dist.defaultTexture);
    if (!parcelLabel.trim()) {
      setParcelLabel(locale === "az" ? dist.nameAz : dist.nameEn);
    }
  }

  async function handleAddParcel(e: FormEvent) {
    e.preventDefault();
    if (addingParcel) return;
    setParcelError(null);
    const lat = Number(parcelLat);
    const lon = Number(parcelLon);
    const area = Number(parcelArea);
    if (!parcelLabel.trim() || parcelLabel.trim().length < 2) {
      setParcelError("Parcel label must be at least 2 characters.");
      return;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setParcelError(t.errors.invalidLatitude);
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setParcelError(t.errors.invalidLongitude);
      return;
    }
    if (!Number.isFinite(area) || area <= 0 || area > 100000) {
      setParcelError(t.errors.invalidArea);
      return;
    }
    const presetMatch = VERIFIED_AZ_REGIONS.find((r) => r.id === parcelRegionId);
    const distMatch = presetMatch ? null : findAzDistrict(parcelRegionId);
    const parsedPh = parcelPh.trim()
      ? Number(parcelPh)
      : (presetMatch?.ph ?? distMatch?.defaultPh ?? 6.8);
    if (!Number.isFinite(parsedPh) || parsedPh < 0 || parsedPh > 14) {
      setParcelError(t.errors.invalidPh);
      return;
    }

    setAddingParcel(true);
    const res = await addParcel({
      label: parcelLabel.trim(),
      region_id: parcelRegionId,
      latitude: lat,
      longitude: lon,
      area_ha: area,
      irrigation_type: parcelIrrigation,
      irrigation_budget_mm: parcelIrrigation === "irrigated" ? 320 : null,
      soil_ph: parsedPh,
      soil_texture: parcelTexture,
      prior_crop_id: parcelCrop,
      lab_metrics: presetMatch
        ? {
            organic_matter_pct: presetMatch.labMetrics.organicMatterPct,
            nitrogen_mg_kg: presetMatch.labMetrics.nitrogenMgKg,
            phosphorus_mg_kg: presetMatch.labMetrics.phosphorusMgKg,
            potassium_mg_kg: presetMatch.labMetrics.potassiumMgKg,
            ec_ds_m: presetMatch.labMetrics.ecDsM,
            moisture_capacity_pct: presetMatch.labMetrics.moistureCapacityPct,
            depth_top_cm: 0,
            depth_bottom_cm: 30,
            sample_date: presetMatch.soilSampleDate,
            lab_report_id: presetMatch.soilSourceRef,
            soil_source_type: "laboratory",
          }
        : undefined,
      is_primary: true,
    });
    setAddingParcel(false);
    if (!res.ok) {
      setParcelError(res.error ?? "Failed to create parcel");
      return;
    }
    setParcelLabel("");
    setShowAddParcel(false);
    showToast(p.savedToast);
  }

  async function handleDeleteParcel(parcelId: string) {
    if (parcels.length <= 1) {
      showToast(p.cannotDeleteLast);
      return;
    }
    const res = await removeParcel(parcelId);
    if (!res.ok && res.error) {
      showToast(res.error);
    }
  }

  return (
    <AppShell>
      <div className="sf-container sf-section" style={{ paddingTop: 28, paddingBottom: 60 }}>
      <div className="sf-page-head" style={{ marginBottom: 20 }}>
        <div>
          <span className="sf-eyebrow">CODE44 · {t.nav.profile}</span>
          <h1>{p.title}</h1>
          <p className="sf-subtitle">{p.subtitle}</p>
        </div>
      </div>

      {/* Main Sheet matching structured 3-column Info Form layout */}
      <form className="sf-profile-sheet" onSubmit={handleProfileSubmit} noValidate>
        {/* Top Row: Avatar + Red-Asterisk Required Banner + Top-Right Action Pills */}
        <div className="sf-profile-hero-row">
          <div className="sf-profile-avatar-block">
            <div className="sf-profile-avatar-frame">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="sf-profile-avatar-img" />
              ) : (
                <div className="sf-profile-avatar-fallback">{initials || "SF"}</div>
              )}
              <button
                type="button"
                className="sf-profile-avatar-cam"
                onClick={() => fileInputRef.current?.click()}
                title={p.photoUploadBtn}
                aria-label={p.photoUploadBtn}
              >
                <Camera size={14} aria-hidden="true" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarSelect}
              />
            </div>

            <div className="sf-profile-notice">
              <div className="sf-profile-notice-title">
                <span className="sf-required-star" aria-hidden="true">*</span>
                <span>{p.requiredBannerTitle}</span>
              </div>
              <p className="sf-profile-notice-note">{p.requiredBannerNote}</p>
              {avatarUrl && (
                <button
                  type="button"
                  className="sf-profile-link-clear"
                  onClick={() => setAvatarUrl(null)}
                >
                  <X size={12} aria-hidden="true" />
                  <span>{p.photoRemoveBtn}</span>
                </button>
              )}
            </div>
          </div>

          <div className="sf-profile-top-actions">
            <button
              type="button"
              className="sf-btn-pill-outline"
              onClick={() => navigate("/field")}
            >
              <span>{p.openFieldBtn}</span>
            </button>
            <button
              type="button"
              className="sf-btn-pill-solid"
              onClick={() => navigate("/ai")}
            >
              <Bot size={14} aria-hidden="true" />
              <span>{p.openAiBtn}</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <hr className="sf-profile-divider" />

        {formError && (
          <div className="sf-banner sf-banner-error" role="alert" style={{ marginBottom: 18 }}>
            <span>{formError}</span>
          </div>
        )}

        {/* 3-Column Form Grid */}
        <div className="sf-profile-grid-3">
          <label className="sf-prof-field">
            <span className="sf-prof-label">
              {p.fullNameLabel}
              <span className="sf-required-star">*</span>
            </span>
            <input
              type="text"
              className="sf-prof-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="sf-prof-field">
            <span className="sf-prof-label">{p.usernameLabel}</span>
            <input
              type="text"
              className="sf-prof-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@farmer"
            />
          </label>

          <div className="sf-prof-field">
            <span className="sf-prof-label">{p.phoneLabel}</span>
            <div className="sf-phone-combo">
              <select
                className="sf-phone-code"
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
                aria-label="Country code"
              >
                {PHONE_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                className="sf-phone-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="50 123 45 67"
              />
            </div>
          </div>

          <label className="sf-prof-field">
            <span className="sf-prof-label">
              {p.activeSinceLabel}
              <span className="sf-required-star">*</span>
            </span>
            <input
              type="date"
              className="sf-prof-input"
              value={activeSince}
              onChange={(e) => setActiveSince(e.target.value)}
              required
            />
          </label>

          <label className="sf-prof-field">
            <span className="sf-prof-label">
              {p.regionLabel}
              <span className="sf-required-star">*</span>
            </span>
            <input
              type="text"
              className="sf-prof-input"
              list="sf-az-regions"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
            />
            <datalist id="sf-az-regions">
              <option value="Ganja-Dashkasan" />
              <option value="Aran (Barda–Yevlakh)" />
              <option value="Quba-Khachmaz" />
              <option value="Shaki-Zagatala" />
              {AZ_DISTRICTS.map((d) => (
                <option key={d.id} value={locale === "az" ? d.nameAz : d.nameEn} />
              ))}
            </datalist>
          </label>

          <label className="sf-prof-field">
            <span className="sf-prof-label">
              {p.emailLabel}
              <span className="sf-required-star">*</span>
            </span>
            <input
              type="email"
              className="sf-prof-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
        </div>

        {/* Side-by-Side Segmented Pill Groups */}
        <div className="sf-profile-grid-2">
          <div className="sf-prof-field">
            <span className="sf-prof-label">
              {p.roleGroupLabel}
              <span className="sf-required-star">*</span>
            </span>
            <div className="sf-segmented-group" role="radiogroup" aria-label={p.roleGroupLabel}>
              {(["farmer", "agronomist", "cooperative", "researcher"] as const).map((rKey) => (
                <button
                  key={rKey}
                  type="button"
                  role="radio"
                  aria-checked={roleType === rKey}
                  className={`sf-seg-btn ${roleType === rKey ? "is-active" : ""}`}
                  onClick={() => setRoleType(rKey)}
                >
                  {p.roles[rKey]}
                </button>
              ))}
            </div>
          </div>

          <div className="sf-prof-field">
            <span className="sf-prof-label">
              {p.irrigationGroupLabel}
              <span className="sf-required-star">*</span>
            </span>
            <div
              className="sf-segmented-group"
              role="radiogroup"
              aria-label={p.irrigationGroupLabel}
            >
              {(["irrigated", "rainfed", "hybrid"] as const).map((iKey) => (
                <button
                  key={iKey}
                  type="button"
                  role="radio"
                  aria-checked={irrigationPref === iKey}
                  className={`sf-seg-btn ${irrigationPref === iKey ? "is-active" : ""}`}
                  onClick={() => setIrrigationPref(iKey)}
                >
                  {p.irrigations[iKey]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Full-Width Bio Textarea with live character count */}
        <div className="sf-prof-field" style={{ marginTop: 18 }}>
          <span className="sf-prof-label">
            {p.bioLabel}
            <span className="sf-required-star">*</span>
          </span>
          <div className="sf-bio-wrap">
            <textarea
              className="sf-prof-textarea"
              rows={4}
              maxLength={1200}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={p.bioPlaceholder}
            />
            <span className="sf-bio-counter">{bio.length} / 1200</span>
          </div>
        </div>

        <div className="sf-profile-save-bar">
          <button type="submit" className="sf-btn sf-btn-primary" disabled={saving}>
            <Save size={15} aria-hidden="true" />
            <span>{saving ? p.savingBtn : p.saveBtn}</span>
          </button>
        </div>

        <hr className="sf-profile-divider" style={{ marginTop: 26 }} />

        {/* Repeat Section: Linked Farm Plots / Parcels */}
        <div className="sf-parcels-section">
          <div className="sf-parcels-head">
            <div>
              <h2>{p.parcelsSectionTitle}</h2>
              <p>{p.parcelsSectionNote}</p>
            </div>
            <button
              type="button"
              className="sf-btn sf-btn-sm sf-btn-primary"
              onClick={() => {
                setParcelError(null);
                setShowAddParcel((v) => !v);
              }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>{showAddParcel ? p.cancelBtn : p.addParcelBtn}</span>
            </button>
          </div>

          {showAddParcel && (
            <div className="sf-parcel-add-box">
              <div className="sf-parcel-add-head">
                <strong>{p.newParcelTitle}</strong>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {VERIFIED_AZ_REGIONS.map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      className={`sf-btn sf-btn-sm ${parcelRegionId === reg.id ? "sf-btn-primary" : ""}`}
                      onClick={() => handlePresetSelect(reg.id)}
                    >
                      ★ {locale === "az" ? reg.nameAz : reg.nameEn}
                    </button>
                  ))}
                  <select
                    className="sf-prof-select"
                    aria-label={locale === "az" ? "Bütün 67 rayon" : "All 67 districts"}
                    value={parcelRegionId}
                    onChange={(e) => {
                      if (e.target.value) handlePresetSelect(e.target.value);
                    }}
                    style={{ maxWidth: 230, fontSize: 12, padding: "6px 10px" }}
                  >
                    <optgroup label={locale === "az" ? "★ Əsas Bölgələr (4)" : "★ Primary Regions (4)"}>
                      {VERIFIED_AZ_REGIONS.map((reg) => (
                        <option key={reg.id} value={reg.id}>
                          ★ {locale === "az" ? reg.nameAz : reg.nameEn}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={locale === "az" ? `Bütün ${AZ_DISTRICTS.length} Rayon` : `All ${AZ_DISTRICTS.length} Districts`}>
                      {AZ_DISTRICTS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {locale === "az" ? `${d.nameAz} (${d.elevationM.toFixed(0)}m)` : `${d.nameEn} (${d.elevationM.toFixed(0)}m)`}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {parcelError && (
                <div className="sf-banner sf-banner-error" role="alert" style={{ marginBottom: 10 }}>
                  <span>{parcelError}</span>
                </div>
              )}

              <div className="sf-profile-grid-3" style={{ marginTop: 10 }}>
                <label className="sf-prof-field">
                  <span className="sf-prof-label">{p.parcelNameLabel}</span>
                  <input
                    type="text"
                    className="sf-prof-input"
                    value={parcelLabel}
                    onChange={(e) => setParcelLabel(e.target.value)}
                    placeholder="e.g. Ganja North Block B"
                  />
                </label>

                <label className="sf-prof-field">
                  <span className="sf-prof-label">{p.parcelLatLabel}</span>
                  <input
                    type="number"
                    step="0.0001"
                    className="sf-prof-input"
                    value={parcelLat}
                    onChange={(e) => setParcelLat(e.target.value)}
                  />
                </label>

                <label className="sf-prof-field">
                  <span className="sf-prof-label">{p.parcelLonLabel}</span>
                  <input
                    type="number"
                    step="0.0001"
                    className="sf-prof-input"
                    value={parcelLon}
                    onChange={(e) => setParcelLon(e.target.value)}
                  />
                </label>

                <label className="sf-prof-field">
                  <span className="sf-prof-label">{p.parcelAreaLabel}</span>
                  <input
                    type="number"
                    step="0.1"
                    className="sf-prof-input"
                    value={parcelArea}
                    onChange={(e) => setParcelArea(e.target.value)}
                  />
                </label>

                <label className="sf-prof-field">
                  <span className="sf-prof-label">{p.parcelIrrigationLabel}</span>
                  <select
                    className="sf-prof-input"
                    value={parcelIrrigation}
                    onChange={(e) => setParcelIrrigation(e.target.value as IrrigationType)}
                  >
                    <option value="irrigated">{t.field.irrigations.irrigated}</option>
                    <option value="rainfed">{t.field.irrigations.rainfed}</option>
                  </select>
                </label>

                <label className="sf-prof-field">
                  <span className="sf-prof-label">{p.parcelPhLabel}</span>
                  <input
                    type="number"
                    step="0.1"
                    className="sf-prof-input"
                    value={parcelPh}
                    onChange={(e) => setParcelPh(e.target.value)}
                    placeholder="6.8"
                  />
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="sf-btn sf-btn-sm"
                  onClick={() => setShowAddParcel(false)}
                >
                  {p.cancelBtn}
                </button>
                <button
                  type="button"
                  className="sf-btn sf-btn-sm sf-btn-primary"
                  disabled={addingParcel}
                  onClick={handleAddParcel}
                >
                  <Check size={14} aria-hidden="true" />
                  <span>{p.parcelSaveBtn}</span>
                </button>
              </div>
            </div>
          )}

          <div className="sf-parcel-rows">
            {parcels.map((parcel) => (
              <div
                key={parcel.id}
                className={`sf-parcel-row ${parcel.is_primary ? "is-primary" : ""}`}
              >
                <div className="sf-parcel-cell sf-parcel-name">
                  <MapPin size={15} aria-hidden="true" />
                  <div>
                    <strong>{parcel.label}</strong>
                    <span className="mono">
                      {parcel.latitude.toFixed(4)}°N, {parcel.longitude.toFixed(4)}°E ·{" "}
                      {parcel.area_ha} ha
                    </span>
                  </div>
                </div>

                <div className="sf-parcel-cell">
                  <Sprout size={14} aria-hidden="true" />
                  <span>
                    {parcel.prior_crop_id} ·{" "}
                    {t.field.irrigations[parcel.irrigation_type] ?? parcel.irrigation_type} ·{" "}
                    pH {parcel.soil_ph !== null ? parcel.soil_ph.toFixed(1) : t.badges.unknown}
                  </span>
                </div>

                <div className="sf-parcel-actions">
                  {parcel.is_primary ? (
                    <span className="sf-badge sf-badge-cyan">{p.activeBadge}</span>
                  ) : (
                    <button
                      type="button"
                      className="sf-btn sf-btn-sm"
                      onClick={() => void setActiveParcel(parcel.id)}
                    >
                      {p.activateBtn}
                    </button>
                  )}

                  <button
                    type="button"
                    className="sf-parcel-trash"
                    onClick={() => void handleDeleteParcel(parcel.id)}
                    title={p.deleteBtn}
                    aria-label={`${p.deleteBtn} ${parcel.label}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
      </div>
    </AppShell>
  );
}
