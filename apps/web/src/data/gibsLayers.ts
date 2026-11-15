export type GibsLayerId = "none" | "ndvi" | "soil_moisture" | "precipitation" | "lst";

export interface GibsLayerSpec {
  id: Exclude<GibsLayerId, "none">;
  wmtsLayer: string;
  compositeDate: string;
  tileMatrixSet: string;
  maxNativeZoom: number;
  recommendedZoom: number;
  tileUrl: string;
  sensorTag: string;
  gradientCss: string;
  lowLabelEn: string;
  highLabelEn: string;
  lowLabelAz: string;
  highLabelAz: string;
}

export const NASA_GIBS_LAYERS: readonly GibsLayerSpec[] = [
  {
    id: "ndvi",
    wmtsLayer: "MODIS_Terra_L3_NDVI_16Day",
    compositeDate: "2024-07-11",
    tileMatrixSet: "GoogleMapsCompatible_Level9",
    maxNativeZoom: 9,
    recommendedZoom: 8,
    tileUrl:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_NDVI_16Day/default/2024-07-11/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
    sensorTag: "MODIS Terra · 16-Day NDVI",
    gradientCss: "linear-gradient(90deg, #b45309 0%, #eab308 45%, #16a34a 100%)",
    lowLabelEn: "Sparse / bare",
    highLabelEn: "Dense vegetation",
    lowLabelAz: "Seyrək / açıq torpaq",
    highLabelAz: "Sıx bitki örtüyü",
  },
  {
    id: "soil_moisture",
    wmtsLayer: "SMAP_L4_Analyzed_Surface_Soil_Moisture",
    compositeDate: "2024-07-11",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    maxNativeZoom: 6,
    recommendedZoom: 7,
    tileUrl:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L4_Analyzed_Surface_Soil_Moisture/default/2024-07-11/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png",
    sensorTag: "SMAP L4 · 9 km Soil Moisture",
    gradientCss: "linear-gradient(90deg, #dc2626 0%, #facc15 45%, #06b6d4 100%)",
    lowLabelEn: "Dry surface",
    highLabelEn: "Wet / saturated",
    lowLabelAz: "Quru səth",
    highLabelAz: "Nəm / doymuş",
  },
  {
    id: "precipitation",
    wmtsLayer: "IMERG_Precipitation_Rate",
    compositeDate: "2024-07-11",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    maxNativeZoom: 6,
    recommendedZoom: 7,
    tileUrl:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/2024-07-11/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png",
    sensorTag: "GPM IMERG · Rain Rate",
    gradientCss: "linear-gradient(90deg, #22d3ee 0%, #3b82f6 50%, #a855f7 100%)",
    lowLabelEn: "Light rain",
    highLabelEn: "Intense rain",
    lowLabelAz: "Zəif yağıntı",
    highLabelAz: "Güclü yağıntı",
  },
  {
    id: "lst",
    wmtsLayer: "MODIS_Terra_Land_Surface_Temp_Day",
    compositeDate: "2024-07-11",
    tileMatrixSet: "GoogleMapsCompatible_Level7",
    maxNativeZoom: 7,
    recommendedZoom: 7,
    tileUrl:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/2024-07-11/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png",
    sensorTag: "MODIS Terra · Day LST",
    gradientCss: "linear-gradient(90deg, #38bdf8 0%, #f59e0b 55%, #ef4444 100%)",
    lowLabelEn: "Cooler surface",
    highLabelEn: "Heat stress peak",
    lowLabelAz: "Sərin səth",
    highLabelAz: "İstilik piki",
  },
] as const;

export const NASA_GIBS_LAYER_MAP: Record<Exclude<GibsLayerId, "none">, GibsLayerSpec> = {
  ndvi: NASA_GIBS_LAYERS[0],
  soil_moisture: NASA_GIBS_LAYERS[1],
  precipitation: NASA_GIBS_LAYERS[2],
  lst: NASA_GIBS_LAYERS[3],
};
