import type { OrbitalLocationPreset, SatelliteFilterMode, SatelliteTleRecord } from "../types";

export const ORBITAL_PRESETS: OrbitalLocationPreset[] = [
  {
    id: "ganja",
    nameEn: "Ganja — Samukh Agro Basin",
    nameAz: "Gəncə — Samux Aqro-Sektoru",
    regionLabel: "Western Azerbaijan • Ganja-Dashkasan",
    country: "Azerbaijan",
    lat: 40.68,
    lon: 46.36,
    defaultAreaHa: 28.4,
    elevationM: 408,
    climateZone: "Semi-arid Piedmont / Irrigable Steppe",
    polygon: [
      [40.6824, 46.3562],
      [40.6848, 46.3621],
      [40.6806, 46.3665],
      [40.6774, 46.3638],
      [40.6788, 46.3574],
    ],
  },
  {
    id: "aran-barda",
    nameEn: "Aran / Barda-Yevlakh",
    nameAz: "Aran / Bərdə-Yevlax",
    regionLabel: "Central Kura-Aras Lowland",
    country: "Azerbaijan",
    lat: 40.385,
    lon: 47.072,
    defaultAreaHa: 42.0,
    elevationM: 76,
    climateZone: "Warm Irrigated Alluvial Plain",
    polygon: [
      [40.3882, 47.0672],
      [40.3902, 47.0754],
      [40.3836, 47.0782],
      [40.3812, 47.0698],
    ],
  },
  {
    id: "quba-khachmaz",
    nameEn: "Quba-Khachmaz Coastal Belt",
    nameAz: "Quba-Xaçmaz Sahil Qurşağı",
    regionLabel: "Northeastern Caspian Foothills",
    country: "Azerbaijan",
    lat: 41.36,
    lon: 48.51,
    defaultAreaHa: 31.5,
    elevationM: 585,
    climateZone: "Temperate Humid Orchard Corridor",
    polygon: [
      [41.3634, 48.5048],
      [41.3662, 48.5142],
      [41.3585, 48.5171],
      [41.3568, 48.5065],
    ],
  },
  {
    id: "sheki-zaqatala",
    nameEn: "Sheki-Zaqatala Foothills",
    nameAz: "Şəki-Zaqatala Dağətəyi",
    regionLabel: "Northwestern Agro-Valley",
    country: "Azerbaijan",
    lat: 41.19,
    lon: 47.17,
    defaultAreaHa: 36.2,
    elevationM: 540,
    climateZone: "Sub-humid Foothill Cereal & Nut Belt",
    polygon: [
      [41.1938, 47.1642],
      [41.1965, 47.1748],
      [41.1889, 47.1774],
      [41.1862, 47.1665],
    ],
  },
  {
    id: "konya-basin",
    nameEn: "Konya Cereal Plain",
    nameAz: "Konya Taxıl Düzənliyi",
    regionLabel: "Central Anatolia Benchmark",
    country: "Turkey",
    lat: 37.87,
    lon: 32.48,
    defaultAreaHa: 54.0,
    elevationM: 1016,
    climateZone: "Semi-arid Continental Highland",
    polygon: [
      [37.8745, 32.4730],
      [37.8772, 32.4855],
      [37.8685, 32.4882],
      [37.8658, 32.4755],
    ],
  },
];

/** Official NASA Earth Observation Satellites with NASA JPL Eyes-on-the-Earth .glb CAD & verified CelesTrak TLEs */
export const DEFAULT_NASA_SATELLITE_TLES: Record<"terra" | "landsat8", SatelliteTleRecord> = {
  terra: {
    id: "terra",
    noradId: 25994,
    name: "NASA TERRA (EOS AM-1)",
    instrument: "MODIS / ASTER / CERES",
    glbUrl: "/models/cloudsat_c.glb",
    line1: "1 25994U 99068A   26318.26383354  .00000353  00000+0  80719-4 0  9994",
    line2: "2 25994  97.9264   1.7139 0003548 108.2320 317.4647 14.61197239431525",
    epochSource: "celestrak_verified_snapshot",
  },
  landsat8: {
    id: "landsat8",
    noradId: 39084,
    name: "NASA / USGS LANDSAT 8",
    instrument: "OLI Optical / TIRS Thermal",
    glbUrl: "/models/sentinel6.glb",
    line1: "1 39084U 13008A   26318.27434811  .00000312  00000+0  79395-4 0  9998",
    line2: "2 39084  98.2147  26.4936 0001223  90.5627 269.5712 14.57111824719759",
    epochSource: "celestrak_verified_snapshot",
  },
};

export interface SatelliteFilterSpec {
  id: SatelliteFilterMode;
  labelEn: string;
  labelAz: string;
  shortTag: string;
  sensorBand: string;
  sourceAttribution: string;
  descriptionEn: string;
  descriptionAz: string;
  legendStops?: Array<{ label: string; color: string }>;
}

export const SATELLITE_FILTERS: SatelliteFilterSpec[] = [
  {
    id: "normal",
    labelEn: "Normal Optical",
    labelAz: "Normal (Optik)",
    shortTag: "NASA 5K OPTICAL",
    sensorBand: "VIS 0.45–0.69 µm • NASA Blue Marble NextGen + Esri",
    sourceAttribution: "NASA GIBS BlueMarble_NextGeneration + Esri World Imagery",
    descriptionEn:
      "Natural orbital daylight imagery with 3D topographic relief shading, cloud layer, and night city lights.",
    descriptionAz:
      "3D relyef kölgələməsi, bulud qatı və gecə şəhər işıqları ilə real orbital optik Yer görüntüsü.",
  },
  {
    id: "thermal",
    labelEn: "Real Thermal IR",
    labelAz: "Real İstilik (MODIS)",
    shortTag: "MODIS LST 11 µm",
    sensorBand: "NASA MODIS Terra Land Surface Temp + Live Open-Meteo",
    sourceAttribution: "NASA GIBS MODIS_Terra_Land_Surface_Temp_Day + Open-Meteo 2m Temp",
    descriptionEn:
      "Real NASA MODIS satellite land-surface thermal radiance overlaid with live global meteorological surface temperatures.",
    descriptionAz:
      "NASA MODIS peykinin real yer səthi istilik xəritəsi və canlı qlobal meteoroloji temperatur paylanması.",
    legendStops: [
      { label: "-15°C", color: "#1d4ed8" },
      { label: "5°C", color: "#7c3aed" },
      { label: "20°C", color: "#ec4899" },
      { label: "32°C", color: "#f97316" },
      { label: "45°C+", color: "#fef08a" },
    ],
  },
  {
    id: "wind",
    labelEn: "Live Wind Streams",
    labelAz: "Real Külək Axınları",
    shortTag: "LIVE 10m WIND",
    sensorBand: "Global Gridded Wind Vectors (Open-Meteo Live U/V)",
    sourceAttribution: "Open-Meteo Real-Time Global Atmospheric Wind Grid (m/s)",
    descriptionEn:
      "Laminar 3D wind streamlines and zoomed map flow particles driven directly by real meteorological U/V wind measurements.",
    descriptionAz:
      "Canlı qlobal meteoroloji külək sürəti və istiqamət məlumatları ilə işləyən real 3D və xəritə hava axınları.",
    legendStops: [
      { label: "2 m/s", color: "#38bdf8" },
      { label: "8 m/s", color: "#2dd4bf" },
      { label: "15 m/s", color: "#a855f7" },
      { label: "24+ m/s", color: "#f472b6" },
    ],
  },
  {
    id: "ndvi",
    labelEn: "Real Crop NDVI",
    labelAz: "Real Bitki (NDVI)",
    shortTag: "MODIS NDVI 250m",
    sensorBand: "NASA MODIS Terra 16-Day Vegetation Reflectance",
    sourceAttribution: "NASA GIBS MODIS_Terra_L3_NDVI_16Day",
    descriptionEn:
      "Real NASA MODIS Terra vegetation biomass index distinguishing fertile crop valleys from arid steppes.",
    descriptionAz:
      "Münbit əkinçilik vadilərini quraq ərazilərdən ayıran real NASA MODIS Terra vegetasiya indeksi.",
    legendStops: [
      { label: "Bare Soil", color: "#334155" },
      { label: "Sparse", color: "#854d0e" },
      { label: "Moderate", color: "#16a34a" },
      { label: "Dense Crop", color: "#4ade80" },
    ],
  },
];

export {
  buildParcelAroundPoint,
  computeGeodesicAreaHa,
} from "../../../utils/polygonMetrics";
