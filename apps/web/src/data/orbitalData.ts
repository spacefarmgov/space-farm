export type Language = "en" | "az";

export type ScreenId =
  | "01-home"
  | "02-explorer"
  | "03-field"
  | "04-climate"
  | "05-rotation"
  | "06-scenario"
  | "07-sources";

export interface MonthlyClimatePoint {
  month: number;
  monthLabelEn: string;
  monthLabelAz: string;
  t2m: number;
  tmin: number;
  tmax: number;
  precip: number;
}

export interface RegionPreset {
  id: string;
  farmId: string;
  nameEn: string;
  nameAz: string;
  zoneEn: string;
  zoneAz: string;
  latitude: number;
  longitude: number;
  elevationM: number;
  defaultAreaHa: number;
  queryHash: string;
  payloadSha256: string;
  meanTempC: number;
  minTempC: number;
  maxTempC: number;
  annualPrecipMm: number;
  frostDays: number;
  wetDays: number;
  mapX: number; // % on Azerbaijan orbital map SVG
  mapY: number; // % on Azerbaijan orbital map SVG
  polygonPoints: Array<{ x: number; y: number }>;
  monthly2024: MonthlyClimatePoint[];
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_AZ = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

function attachMonthLabels(
  raw: Array<{ month: number; t2m: number; tmin: number; tmax: number; precip: number }>
): MonthlyClimatePoint[] {
  return raw.map((item) => ({
    ...item,
    monthLabelEn: MONTHS_EN[item.month - 1] ?? `M${item.month}`,
    monthLabelAz: MONTHS_AZ[item.month - 1] ?? `A${item.month}`,
  }));
}

export const AZERBAIJAN_REGIONS: RegionPreset[] = [
  {
    id: "ganja",
    farmId: "ganja-demo",
    nameEn: "Ganja demo field",
    nameAz: "Gəncə demo sahəsi",
    zoneEn: "Ganja-Dashkasan • Western Foothills Pilot",
    zoneAz: "Gəncə-Daşkəsən • Qərb dağətəyi pilot sahə",
    latitude: 40.68,
    longitude: 46.36,
    elevationM: 1313.31,
    defaultAreaHa: 28.4,
    queryHash: "552e40e213b9f7b8",
    payloadSha256: "22b70694bb786042a84df2371af88ddca8b0485858b8ce51e20d1cb99474bf44",
    meanTempC: 10.58,
    minTempC: -10.99,
    maxTempC: 32.09,
    annualPrecipMm: 506.52,
    frostDays: 98,
    wetDays: 108,
    mapX: 33,
    mapY: 46,
    polygonPoints: [
      { x: 26, y: 58 },
      { x: 56, y: 24 },
      { x: 78, y: 40 },
      { x: 48, y: 78 },
    ],
    monthly2024: attachMonthLabels([
      { month: 1, t2m: -0.2, tmin: -11.0, tmax: 12.6, precip: 37.2 },
      { month: 2, t2m: 1.2, tmin: -8.6, tmax: 15.8, precip: 7.2 },
      { month: 3, t2m: 4.0, tmin: -4.8, tmax: 18.0, precip: 55.3 },
      { month: 4, t2m: 12.9, tmin: 3.2, tmax: 26.4, precip: 19.8 },
      { month: 5, t2m: 12.8, tmin: 2.7, tmax: 28.4, precip: 95.9 },
      { month: 6, t2m: 20.0, tmin: 10.5, tmax: 29.8, precip: 72.0 },
      { month: 7, t2m: 21.1, tmin: 9.8, tmax: 31.9, precip: 94.6 },
      { month: 8, t2m: 21.4, tmin: 12.9, tmax: 32.1, precip: 11.7 },
      { month: 9, t2m: 16.9, tmin: 4.9, tmax: 31.2, precip: 26.4 },
      { month: 10, t2m: 10.6, tmin: 0.5, tmax: 26.8, precip: 49.6 },
      { month: 11, t2m: 4.9, tmin: -2.2, tmax: 18.0, precip: 28.2 },
      { month: 12, t2m: 1.0, tmin: -8.5, tmax: 11.0, precip: 8.6 },
    ]),
  },
  {
    id: "aran",
    farmId: "aran-barda-field",
    nameEn: "Aran (Barda-Yevlakh) field",
    nameAz: "Aran (Bərdə-Yevlax) sahəsi",
    zoneEn: "Kura-Aras Lowland • Semi-Arid Agricultural Belt",
    zoneAz: "Kür-Araz ovalığı • Quraq əkinçilik qurşağı",
    latitude: 40.38,
    longitude: 47.12,
    elevationM: 407.41,
    defaultAreaHa: 42.0,
    queryHash: "a56184dd09acd946",
    payloadSha256: "512797f922453b9c8df53738d0d40e06ede038bab41707809da5b3338a4cf1f7",
    meanTempC: 15.7,
    minTempC: -6.35,
    maxTempC: 38.92,
    annualPrecipMm: 457.5,
    frostDays: 34,
    wetDays: 95,
    mapX: 49,
    mapY: 54,
    polygonPoints: [
      { x: 22, y: 48 },
      { x: 64, y: 26 },
      { x: 82, y: 52 },
      { x: 40, y: 76 },
    ],
    monthly2024: attachMonthLabels([
      { month: 1, t2m: 4.3, tmin: -6.3, tmax: 18.4, precip: 35.7 },
      { month: 2, t2m: 6.0, tmin: -5.0, tmax: 22.3, precip: 9.5 },
      { month: 3, t2m: 8.4, tmin: -2.3, tmax: 23.7, precip: 53.4 },
      { month: 4, t2m: 17.6, tmin: 6.4, tmax: 32.4, precip: 19.2 },
      { month: 5, t2m: 17.9, tmin: 7.2, tmax: 34.3, precip: 77.6 },
      { month: 6, t2m: 26.2, tmin: 16.9, tmax: 36.7, precip: 80.5 },
      { month: 7, t2m: 27.4, tmin: 15.8, tmax: 38.9, precip: 79.6 },
      { month: 8, t2m: 27.5, tmin: 18.2, tmax: 38.0, precip: 10.0 },
      { month: 9, t2m: 22.5, tmin: 10.1, tmax: 36.2, precip: 19.6 },
      { month: 10, t2m: 15.3, tmin: 5.1, tmax: 32.3, precip: 39.4 },
      { month: 11, t2m: 9.6, tmin: 2.0, tmax: 23.3, precip: 28.0 },
      { month: 12, t2m: 5.5, tmin: -4.4, tmax: 16.3, precip: 5.0 },
    ]),
  },
  {
    id: "quba",
    farmId: "quba-khachmaz-field",
    nameEn: "Quba-Khachmaz field",
    nameAz: "Quba-Xaçmaz sahəsi",
    zoneEn: "Northeastern Caspian Slope • Sub-Humid Zone",
    zoneAz: "Şimal-Şərq Xəzəryanı • Mülayim-rütubətli zona",
    latitude: 41.36,
    longitude: 48.51,
    elevationM: 149.23,
    defaultAreaHa: 31.5,
    queryHash: "f850af6ab056dbf6",
    payloadSha256: "a1d90215e046fefd30243a0d1d9a6ead6a3e7beef5ef7e99a6722cf9d0d06dff",
    meanTempC: 15.04,
    minTempC: -3.66,
    maxTempC: 39.27,
    annualPrecipMm: 516.2,
    frostDays: 34,
    wetDays: 101,
    mapX: 69,
    mapY: 28,
    polygonPoints: [
      { x: 28, y: 40 },
      { x: 68, y: 22 },
      { x: 76, y: 58 },
      { x: 34, y: 74 },
    ],
    monthly2024: attachMonthLabels([
      { month: 1, t2m: 4.3, tmin: -3.4, tmax: 20.4, precip: 16.1 },
      { month: 2, t2m: 4.9, tmin: -3.7, tmax: 21.1, precip: 25.4 },
      { month: 3, t2m: 6.5, tmin: -1.8, tmax: 17.2, precip: 47.1 },
      { month: 4, t2m: 17.5, tmin: 6.8, tmax: 33.0, precip: 7.7 },
      { month: 5, t2m: 16.5, tmin: 8.2, tmax: 32.8, precip: 68.4 },
      { month: 6, t2m: 25.4, tmin: 16.7, tmax: 35.8, precip: 82.2 },
      { month: 7, t2m: 26.7, tmin: 18.4, tmax: 35.8, precip: 47.4 },
      { month: 8, t2m: 26.5, tmin: 20.0, tmax: 39.3, precip: 10.1 },
      { month: 9, t2m: 21.8, tmin: 12.3, tmax: 34.9, precip: 32.1 },
      { month: 10, t2m: 15.2, tmin: 6.1, tmax: 33.2, precip: 94.7 },
      { month: 11, t2m: 9.4, tmin: 2.4, tmax: 20.6, precip: 53.8 },
      { month: 12, t2m: 5.6, tmin: -3.5, tmax: 15.5, precip: 31.3 },
    ]),
  },
  {
    id: "sheki",
    farmId: "sheki-zaqatala-field",
    nameEn: "Sheki-Zaqatala field",
    nameAz: "Şəki-Zaqatala sahəsi",
    zoneEn: "Greater Caucasus Southern Slope • High Rainfall Belt",
    zoneAz: "Böyük Qafqazın cənub yamacı • Yüksək yağıntılı qurşaq",
    latitude: 41.19,
    longitude: 47.17,
    elevationM: 312.57,
    defaultAreaHa: 24.0,
    queryHash: "3f72f4396abc697d",
    payloadSha256: "76373e22397a21421e4f1e1c842652ff2c70392ab0b56b3bd2520056f392a9f3",
    meanTempC: 15.65,
    minTempC: -4.08,
    maxTempC: 37.17,
    annualPrecipMm: 588.52,
    frostDays: 28,
    wetDays: 111,
    mapX: 46,
    mapY: 31,
    polygonPoints: [
      { x: 24, y: 52 },
      { x: 58, y: 24 },
      { x: 80, y: 46 },
      { x: 46, y: 76 },
    ],
    monthly2024: attachMonthLabels([
      { month: 1, t2m: 4.3, tmin: -3.7, tmax: 15.2, precip: 37.5 },
      { month: 2, t2m: 5.6, tmin: -4.1, tmax: 19.5, precip: 13.8 },
      { month: 3, t2m: 8.3, tmin: -2.1, tmax: 21.1, precip: 66.6 },
      { month: 4, t2m: 17.1, tmin: 7.9, tmax: 30.2, precip: 20.0 },
      { month: 5, t2m: 18.0, tmin: 8.1, tmax: 32.5, precip: 108.2 },
      { month: 6, t2m: 25.9, tmin: 17.9, tmax: 35.2, precip: 114.7 },
      { month: 7, t2m: 27.2, tmin: 17.1, tmax: 37.2, precip: 97.4 },
      { month: 8, t2m: 27.3, tmin: 19.2, tmax: 36.5, precip: 16.6 },
      { month: 9, t2m: 22.8, tmin: 11.0, tmax: 34.4, precip: 40.2 },
      { month: 10, t2m: 15.7, tmin: 6.7, tmax: 30.6, precip: 41.4 },
      { month: 11, t2m: 9.9, tmin: 2.6, tmax: 21.2, precip: 25.8 },
      { month: 12, t2m: 5.6, tmin: -3.3, tmax: 14.6, precip: 6.3 },
    ]),
  },
];

export interface CropVisualMeta {
  cropId: string;
  icon: string;
  color: string;
  nameEn: string;
  nameAz: string;
  familyLabelEn: string;
  familyLabelAz: string;
}

export const CROP_VISUALS: Record<string, CropVisualMeta> = {
  wheat: {
    cropId: "wheat",
    icon: "🌾",
    color: "#EAB308",
    nameEn: "Winter Wheat",
    nameAz: "Payızlıq Buğda",
    familyLabelEn: "Poaceae (Cereal)",
    familyLabelAz: "Taxıllar (Poaceae)",
  },
  barley: {
    cropId: "barley",
    icon: "🌿",
    color: "#84CC16",
    nameEn: "Barley",
    nameAz: "Arpa",
    familyLabelEn: "Poaceae (Cereal)",
    familyLabelAz: "Taxıllar (Poaceae)",
  },
  chickpea: {
    cropId: "chickpea",
    icon: "🫘",
    color: "#A855F7",
    nameEn: "Chickpea",
    nameAz: "Noxud",
    familyLabelEn: "Fabaceae (N-Fixing Legume)",
    familyLabelAz: "Paxlalılar (Azot toplayan)",
  },
  lentil: {
    cropId: "lentil",
    icon: "🟢",
    color: "#10B981",
    nameEn: "Lentil",
    nameAz: "Mərcimək",
    familyLabelEn: "Fabaceae (N-Fixing Legume)",
    familyLabelAz: "Paxlalılar (Azot toplayan)",
  },
  sunflower: {
    cropId: "sunflower",
    icon: "🌻",
    color: "#F59E0B",
    nameEn: "Sunflower",
    nameAz: "Günəbaxan",
    familyLabelEn: "Asteraceae (Oilseed)",
    familyLabelAz: "Mürəkkəbçiçəklilər (Yağlı bitki)",
  },
  maize: {
    cropId: "maize",
    icon: "🌽",
    color: "#38BDF8",
    nameEn: "Maize (Corn)",
    nameAz: "Qarğıdalı",
    familyLabelEn: "Poaceae (High-Water Cereal)",
    familyLabelAz: "Taxıllar (Yüksək su tələbli)",
  },
};

export const NASA_SUBMISSION_CITATION_EN = `Meteorological and agroclimatic daily time-series parameters (T2M, T2M_MIN, T2M_MAX, PRECTOTCORR) were obtained from the NASA Langley Research Center (LaRC) Prediction Of Worldwide Energy Resources (POWER) Project (API v2.10.3, Agroclimatology AG Community, UTC time standard), funded through the NASA Earth Science/Applied Science Program and derived from NASA GMAO MERRA-2 reanalysis (0.5° × 0.625° spatial resolution) and GEWEX SRB/FLASHFlux datasets. Agronomic water, temperature, soil pH, and rotation rules are referenced against FAO Irrigation and Drainage Paper No. 56 and FAO CROPWAT with explicit source_supported and provisional confidence labels.`;

export const NASA_SUBMISSION_CITATION_AZ = `Gündəlik aqroiqlim göstəriciləri (T2M, T2M_MIN, T2M_MAX, PRECTOTCORR) NASA Langley Tədqiqat Mərkəzinin (LaRC) POWER (Prediction Of Worldwide Energy Resources) layihəsindən (API v2.10.3, AG icması, UTC zaman standartı) əldə edilmişdir. Məlumatlar NASA GMAO MERRA-2 (0.5° × 0.625° məkan qətnaməsi) peyk/reanaliz məhsullarına əsaslanır. Bitki su, temperatur, pH və növbəli əkin qaydaları FAO Paper 56 və FAO CROPWAT bazasına istinad edir və elmi dürüstlük qaydalarına uyğun olaraq source_supported / provisional kimi etiketlənir.`;
