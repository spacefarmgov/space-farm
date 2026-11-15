// Verified 67 Azerbaijan administrative districts backed by real NASA LaRC POWER (2024, 366/366 days) & SRTM/Copernicus 90m DEM.
import type { IrrigationType, SoilTexture } from "../api/types";
import {
  VERIFIED_AZ_REGIONS,
  createDraftFromRegion,
  type FieldDraft,
  type VerifiedRegionPreset,
} from "./regions";

export interface AzDistrictRecord {
  id: string;
  nameEn: string;
  nameAz: string;
  economicRegionEn: string;
  economicRegionAz: string;
  lat: number;
  lon: number;
  elevationM: number;
  irrigation: Extract<IrrigationType, "irrigated" | "rainfed">;
  defaultPh: number;
  defaultTexture: Extract<SoilTexture, "loam" | "clay" | "sand" | "other">;
  meanTempC: number;
  annualRainMm: number;
  humidityPct: number;
  windMs: number;
  nasaValidDays: number;
}

export const AZ_DISTRICTS: readonly AzDistrictRecord[] = [
  { id: "absheron", nameEn: "Absheron", nameAz: "Abşeron", economicRegionEn: "Absheron-Khizi", economicRegionAz: "Abşeron-Xızı", lat: 40.453, lon: 49.754, elevationM: 65.0, irrigation: "irrigated", defaultPh: 6.9, defaultTexture: "loam", meanTempC: 15.9, annualRainMm: 386.4, humidityPct: 75.1, windMs: 4.4, nasaValidDays: 366 },
  { id: "aghjabadi", nameEn: "Aghjabadi", nameAz: "Ağcabədi", economicRegionEn: "Karabakh", economicRegionAz: "Qarabağ", lat: 40.053, lon: 47.46, elevationM: 14.0, irrigation: "irrigated", defaultPh: 7.4, defaultTexture: "clay", meanTempC: 17.3, annualRainMm: 400.0, humidityPct: 61.1, windMs: 1.9, nasaValidDays: 366 },
  { id: "aghdam", nameEn: "Aghdam", nameAz: "Ağdam", economicRegionEn: "Karabakh", economicRegionAz: "Qarabağ", lat: 39.991, lon: 46.931, elevationM: 370.0, irrigation: "irrigated", defaultPh: 7.1, defaultTexture: "loam", meanTempC: 13.9, annualRainMm: 485.0, humidityPct: 63.2, windMs: 1.6, nasaValidDays: 366 },
  { id: "aghdash", nameEn: "Aghdash", nameAz: "Ağdaş", economicRegionEn: "Central Aran", economicRegionAz: "Mərkəzi Aran", lat: 40.647, lon: 47.474, elevationM: 41.0, irrigation: "irrigated", defaultPh: 7.3, defaultTexture: "loam", meanTempC: 17.4, annualRainMm: 458.0, humidityPct: 60.1, windMs: 1.9, nasaValidDays: 366 },
  { id: "aghdara", nameEn: "Aghdara", nameAz: "Ağdərə", economicRegionEn: "Karabakh", economicRegionAz: "Qarabağ", lat: 40.215, lon: 46.823, elevationM: 429.0, irrigation: "rainfed", defaultPh: 6.6, defaultTexture: "loam", meanTempC: 13.9, annualRainMm: 485.0, humidityPct: 63.2, windMs: 1.6, nasaValidDays: 366 },
  { id: "agstafa", nameEn: "Aghstafa", nameAz: "Ağstafa", economicRegionEn: "Gazakh-Tovuz", economicRegionAz: "Qazax-Tovuz", lat: 41.119, lon: 45.454, elevationM: 325.0, irrigation: "irrigated", defaultPh: 7.0, defaultTexture: "loam", meanTempC: 13.5, annualRainMm: 612.7, humidityPct: 66.3, windMs: 1.8, nasaValidDays: 366 },
  { id: "agsu", nameEn: "Aghsu", nameAz: "Ağsu", economicRegionEn: "Mountainous Shirvan", economicRegionAz: "Dağlıq Şirvan", lat: 40.57, lon: 48.401, elevationM: 182.0, irrigation: "rainfed", defaultPh: 7.1, defaultTexture: "clay", meanTempC: 16.4, annualRainMm: 457.4, humidityPct: 60.6, windMs: 1.6, nasaValidDays: 366 },
  { id: "astara", nameEn: "Astara", nameAz: "Astara", economicRegionEn: "Lankaran-Astara", economicRegionAz: "Lənkəran-Astara", lat: 38.456, lon: 48.875, elevationM: -21.0, irrigation: "rainfed", defaultPh: 5.8, defaultTexture: "clay", meanTempC: 13.6, annualRainMm: 843.0, humidityPct: 75.5, windMs: 1.5, nasaValidDays: 366 },
  { id: "babek", nameEn: "Babek", nameAz: "Babək", economicRegionEn: "Nakhchivan", economicRegionAz: "Naxçıvan", lat: 39.151, lon: 45.443, elevationM: 822.0, irrigation: "irrigated", defaultPh: 7.5, defaultTexture: "loam", meanTempC: 12.4, annualRainMm: 417.6, humidityPct: 56.9, windMs: 2.0, nasaValidDays: 366 },
  { id: "balakan", nameEn: "Balakan", nameAz: "Balakən", economicRegionEn: "Shaki-Zagatala", economicRegionAz: "Şəki-Zaqatala", lat: 41.726, lon: 46.404, elevationM: 365.0, irrigation: "rainfed", defaultPh: 6.4, defaultTexture: "loam", meanTempC: 13.7, annualRainMm: 768.7, humidityPct: 69.3, windMs: 1.2, nasaValidDays: 366 },
  { id: "beylagan", nameEn: "Beylagan", nameAz: "Beyləqan", economicRegionEn: "Mil-Mughan", economicRegionAz: "Mil-Muğan", lat: 39.776, lon: 47.619, elevationM: 61.0, irrigation: "irrigated", defaultPh: 7.4, defaultTexture: "loam", meanTempC: 17.3, annualRainMm: 400.0, humidityPct: 61.1, windMs: 1.9, nasaValidDays: 366 },
  { id: "barda", nameEn: "Barda", nameAz: "Bərdə", economicRegionEn: "Karabakh", economicRegionAz: "Qarabağ", lat: 40.376, lon: 47.126, elevationM: 79.0, irrigation: "irrigated", defaultPh: 7.3, defaultTexture: "loam", meanTempC: 15.7, annualRainMm: 457.6, humidityPct: 60.5, windMs: 2.3, nasaValidDays: 366 },
  { id: "bilasuvar", nameEn: "Bilasuvar", nameAz: "Biləsuvar", economicRegionEn: "Shirvan-Salyan", economicRegionAz: "Şirvan-Salyan", lat: 39.458, lon: 48.545, elevationM: 7.0, irrigation: "irrigated", defaultPh: 7.5, defaultTexture: "clay", meanTempC: 17.2, annualRainMm: 474.2, humidityPct: 68.3, windMs: 2.5, nasaValidDays: 366 },
  { id: "jabrayil", nameEn: "Jabrayil", nameAz: "Cəbrayıl", economicRegionEn: "East Zangezur", economicRegionAz: "Şərqi Zəngəzur", lat: 39.4, lon: 47.026, elevationM: 601.0, irrigation: "irrigated", defaultPh: 7.1, defaultTexture: "loam", meanTempC: 14.0, annualRainMm: 494.1, humidityPct: 63.2, windMs: 1.6, nasaValidDays: 366 },
  { id: "jalilabad", nameEn: "Jalilabad", nameAz: "Cəlilabad", economicRegionEn: "Lankaran-Astara", economicRegionAz: "Lənkəran-Astara", lat: 39.205, lon: 48.51, elevationM: 30.0, irrigation: "rainfed", defaultPh: 6.8, defaultTexture: "clay", meanTempC: 16.2, annualRainMm: 800.1, humidityPct: 72.5, windMs: 1.7, nasaValidDays: 366 },
  { id: "julfa", nameEn: "Julfa", nameAz: "Culfa", economicRegionEn: "Nakhchivan", economicRegionAz: "Naxçıvan", lat: 38.954, lon: 45.631, elevationM: 715.0, irrigation: "irrigated", defaultPh: 7.4, defaultTexture: "loam", meanTempC: 12.4, annualRainMm: 417.6, humidityPct: 56.9, windMs: 2.0, nasaValidDays: 366 },
  { id: "dashkasan", nameEn: "Dashkasan", nameAz: "Daşkəsən", economicRegionEn: "Ganja-Dashkasan", economicRegionAz: "Gəncə-Daşkəsən", lat: 40.52, lon: 46.077, elevationM: 1683.0, irrigation: "rainfed", defaultPh: 6.4, defaultTexture: "loam", meanTempC: 10.6, annualRainMm: 506.7, humidityPct: 66.5, windMs: 1.9, nasaValidDays: 366 },
  { id: "fuzuli", nameEn: "Fuzuli", nameAz: "Füzuli", economicRegionEn: "Karabakh", economicRegionAz: "Qarabağ", lat: 39.6, lon: 47.143, elevationM: 429.0, irrigation: "irrigated", defaultPh: 7.2, defaultTexture: "loam", meanTempC: 14.0, annualRainMm: 494.1, humidityPct: 63.2, windMs: 1.6, nasaValidDays: 366 },
  { id: "gadabay", nameEn: "Gadabay", nameAz: "Gədəbəy", economicRegionEn: "Gazakh-Tovuz", economicRegionAz: "Qazax-Tovuz", lat: 40.566, lon: 45.816, elevationM: 1403.0, irrigation: "rainfed", defaultPh: 6.1, defaultTexture: "loam", meanTempC: 8.0, annualRainMm: 549.3, humidityPct: 69.7, windMs: 2.1, nasaValidDays: 366 },
  { id: "goranboy", nameEn: "Goranboy", nameAz: "Goranboy", economicRegionEn: "Ganja-Dashkasan", economicRegionAz: "Gəncə-Daşkəsən", lat: 40.61, lon: 46.789, elevationM: 152.0, irrigation: "irrigated", defaultPh: 7.1, defaultTexture: "loam", meanTempC: 15.7, annualRainMm: 457.6, humidityPct: 60.5, windMs: 2.3, nasaValidDays: 366 },
  { id: "goychay", nameEn: "Goychay", nameAz: "Göyçay", economicRegionEn: "Central Aran", economicRegionAz: "Mərkəzi Aran", lat: 40.653, lon: 47.741, elevationM: 119.0, irrigation: "irrigated", defaultPh: 7.0, defaultTexture: "loam", meanTempC: 17.4, annualRainMm: 458.0, humidityPct: 60.1, windMs: 1.9, nasaValidDays: 366 },
  { id: "goygol", nameEn: "Goygol", nameAz: "Göygöl", economicRegionEn: "Ganja-Dashkasan", economicRegionAz: "Gəncə-Daşkəsən", lat: 40.586, lon: 46.319, elevationM: 685.0, irrigation: "irrigated", defaultPh: 6.8, defaultTexture: "loam", meanTempC: 10.6, annualRainMm: 506.7, humidityPct: 66.5, windMs: 1.9, nasaValidDays: 366 },
  { id: "hajigabul", nameEn: "Hajigabul", nameAz: "Hacıqabul", economicRegionEn: "Shirvan-Salyan", economicRegionAz: "Şirvan-Salyan", lat: 40.043, lon: 48.943, elevationM: 4.0, irrigation: "irrigated", defaultPh: 7.6, defaultTexture: "clay", meanTempC: 16.8, annualRainMm: 423.5, humidityPct: 64.3, windMs: 2.4, nasaValidDays: 366 },
  { id: "khachmaz", nameEn: "Khachmaz", nameAz: "Xaçmaz", economicRegionEn: "Quba-Khachmaz", economicRegionAz: "Quba-Xaçmaz", lat: 41.464, lon: 48.806, elevationM: 43.0, irrigation: "irrigated", defaultPh: 6.7, defaultTexture: "loam", meanTempC: 15.0, annualRainMm: 516.2, humidityPct: 70.0, windMs: 2.8, nasaValidDays: 366 },
  { id: "khizi", nameEn: "Khizi", nameAz: "Xızı", economicRegionEn: "Absheron-Khizi", economicRegionAz: "Abşeron-Xızı", lat: 40.908, lon: 49.075, elevationM: 721.0, irrigation: "rainfed", defaultPh: 6.9, defaultTexture: "clay", meanTempC: 15.9, annualRainMm: 430.4, humidityPct: 69.6, windMs: 4.1, nasaValidDays: 366 },
  { id: "khojali", nameEn: "Khojali", nameAz: "Xocalı", economicRegionEn: "Karabakh", economicRegionAz: "Qarabağ", lat: 39.913, lon: 46.79, elevationM: 582.0, irrigation: "rainfed", defaultPh: 6.7, defaultTexture: "loam", meanTempC: 13.9, annualRainMm: 485.0, humidityPct: 63.2, windMs: 1.6, nasaValidDays: 366 },
  { id: "khojavend", nameEn: "Khojavend", nameAz: "Xocavənd", economicRegionEn: "Karabakh", economicRegionAz: "Qarabağ", lat: 39.792, lon: 47.11, elevationM: 395.0, irrigation: "rainfed", defaultPh: 6.9, defaultTexture: "loam", meanTempC: 13.9, annualRainMm: 485.0, humidityPct: 63.2, windMs: 1.6, nasaValidDays: 366 },
  { id: "imishli", nameEn: "Imishli", nameAz: "İmişli", economicRegionEn: "Mil-Mughan", economicRegionAz: "Mil-Muğan", lat: 39.871, lon: 48.06, elevationM: 0.0, irrigation: "irrigated", defaultPh: 7.5, defaultTexture: "loam", meanTempC: 17.5, annualRainMm: 390.7, humidityPct: 62.1, windMs: 1.8, nasaValidDays: 366 },
  { id: "ismayilli", nameEn: "Ismayilli", nameAz: "İsmayıllı", economicRegionEn: "Mountainous Shirvan", economicRegionAz: "Dağlıq Şirvan", lat: 40.785, lon: 48.151, elevationM: 583.0, irrigation: "rainfed", defaultPh: 6.6, defaultTexture: "loam", meanTempC: 7.9, annualRainMm: 532.9, humidityPct: 73.1, windMs: 1.1, nasaValidDays: 366 },
  { id: "kalbajar", nameEn: "Kalbajar", nameAz: "Kəlbəcər", economicRegionEn: "East Zangezur", economicRegionAz: "Şərqi Zəngəzur", lat: 40.107, lon: 46.038, elevationM: 1608.0, irrigation: "rainfed", defaultPh: 6.2, defaultTexture: "loam", meanTempC: 6.9, annualRainMm: 524.2, humidityPct: 70.6, windMs: 1.5, nasaValidDays: 366 },
  { id: "kangarli", nameEn: "Kangarli", nameAz: "Kəngərli", economicRegionEn: "Nakhchivan", economicRegionAz: "Naxçıvan", lat: 39.4, lon: 45.164, elevationM: 1036.0, irrigation: "irrigated", defaultPh: 7.5, defaultTexture: "loam", meanTempC: 12.8, annualRainMm: 436.9, humidityPct: 55.5, windMs: 1.6, nasaValidDays: 366 },
  { id: "kurdamir", nameEn: "Kurdamir", nameAz: "Kürdəmir", economicRegionEn: "Central Aran", economicRegionAz: "Mərkəzi Aran", lat: 40.345, lon: 48.157, elevationM: 10.0, irrigation: "irrigated", defaultPh: 7.5, defaultTexture: "clay", meanTempC: 16.4, annualRainMm: 457.4, humidityPct: 60.6, windMs: 1.6, nasaValidDays: 366 },
  { id: "qakh", nameEn: "Qakh", nameAz: "Qax", economicRegionEn: "Shaki-Zagatala", economicRegionAz: "Şəki-Zaqatala", lat: 41.418, lon: 46.924, elevationM: 598.0, irrigation: "rainfed", defaultPh: 6.6, defaultTexture: "loam", meanTempC: 10.3, annualRainMm: 766.9, humidityPct: 71.8, windMs: 1.1, nasaValidDays: 366 },
  { id: "qazakh", nameEn: "Qazakh", nameAz: "Qazax", economicRegionEn: "Gazakh-Tovuz", economicRegionAz: "Qazax-Tovuz", lat: 41.092, lon: 45.366, elevationM: 375.0, irrigation: "irrigated", defaultPh: 7.0, defaultTexture: "loam", meanTempC: 13.5, annualRainMm: 612.7, humidityPct: 66.3, windMs: 1.8, nasaValidDays: 366 },
  { id: "gabala", nameEn: "Gabala", nameAz: "Qəbələ", economicRegionEn: "Shaki-Zagatala", economicRegionAz: "Şəki-Zaqatala", lat: 40.982, lon: 47.849, elevationM: 788.0, irrigation: "rainfed", defaultPh: 6.5, defaultTexture: "loam", meanTempC: 7.9, annualRainMm: 532.9, humidityPct: 73.1, windMs: 1.1, nasaValidDays: 366 },
  { id: "gobustan", nameEn: "Gobustan", nameAz: "Qobustan", economicRegionEn: "Mountainous Shirvan", economicRegionAz: "Dağlıq Şirvan", lat: 40.534, lon: 48.928, elevationM: 775.0, irrigation: "rainfed", defaultPh: 7.2, defaultTexture: "clay", meanTempC: 14.0, annualRainMm: 454.7, humidityPct: 65.0, windMs: 1.8, nasaValidDays: 366 },
  { id: "quba", nameEn: "Quba", nameAz: "Quba", economicRegionEn: "Quba-Khachmaz", economicRegionAz: "Quba-Xaçmaz", lat: 41.361, lon: 48.513, elevationM: 598.0, irrigation: "irrigated", defaultPh: 6.4, defaultTexture: "clay", meanTempC: 15.0, annualRainMm: 516.2, humidityPct: 70.0, windMs: 2.8, nasaValidDays: 366 },
  { id: "qubadli", nameEn: "Qubadli", nameAz: "Qubadlı", economicRegionEn: "East Zangezur", economicRegionAz: "Şərqi Zəngəzur", lat: 39.344, lon: 46.582, elevationM: 483.0, irrigation: "rainfed", defaultPh: 6.8, defaultTexture: "loam", meanTempC: 14.0, annualRainMm: 494.1, humidityPct: 63.2, windMs: 1.6, nasaValidDays: 366 },
  { id: "qusar", nameEn: "Qusar", nameAz: "Qusar", economicRegionEn: "Quba-Khachmaz", economicRegionAz: "Quba-Xaçmaz", lat: 41.427, lon: 48.43, elevationM: 680.0, irrigation: "rainfed", defaultPh: 6.3, defaultTexture: "loam", meanTempC: 9.2, annualRainMm: 536.7, humidityPct: 70.0, windMs: 1.1, nasaValidDays: 366 },
  { id: "lachin", nameEn: "Lachin", nameAz: "Laçın", economicRegionEn: "East Zangezur", economicRegionAz: "Şərqi Zəngəzur", lat: 39.638, lon: 46.547, elevationM: 1086.0, irrigation: "rainfed", defaultPh: 6.4, defaultTexture: "loam", meanTempC: 7.8, annualRainMm: 552.9, humidityPct: 68.8, windMs: 2.1, nasaValidDays: 366 },
  { id: "lerik", nameEn: "Lerik", nameAz: "Lerik", economicRegionEn: "Lankaran-Astara", economicRegionAz: "Lənkəran-Astara", lat: 38.774, lon: 48.415, elevationM: 1096.0, irrigation: "rainfed", defaultPh: 6.3, defaultTexture: "loam", meanTempC: 12.4, annualRainMm: 724.6, humidityPct: 70.7, windMs: 2.0, nasaValidDays: 366 },
  { id: "lankaran", nameEn: "Lankaran", nameAz: "Lənkəran", economicRegionEn: "Lankaran-Astara", economicRegionAz: "Lənkəran-Astara", lat: 38.754, lon: 48.851, elevationM: -18.0, irrigation: "rainfed", defaultPh: 5.9, defaultTexture: "clay", meanTempC: 16.2, annualRainMm: 800.1, humidityPct: 72.5, windMs: 1.7, nasaValidDays: 366 },
  { id: "masalli", nameEn: "Masalli", nameAz: "Masallı", economicRegionEn: "Lankaran-Astara", economicRegionAz: "Lənkəran-Astara", lat: 39.035, lon: 48.665, elevationM: 6.0, irrigation: "rainfed", defaultPh: 6.1, defaultTexture: "clay", meanTempC: 16.2, annualRainMm: 800.1, humidityPct: 72.5, windMs: 1.7, nasaValidDays: 366 },
  { id: "neftchala", nameEn: "Neftchala", nameAz: "Neftçala", economicRegionEn: "Shirvan-Salyan", economicRegionAz: "Şirvan-Salyan", lat: 39.377, lon: 49.247, elevationM: -19.0, irrigation: "irrigated", defaultPh: 7.7, defaultTexture: "clay", meanTempC: 17.0, annualRainMm: 641.5, humidityPct: 75.1, windMs: 3.6, nasaValidDays: 366 },
  { id: "oghuz", nameEn: "Oghuz", nameAz: "Oğuz", economicRegionEn: "Shaki-Zagatala", economicRegionAz: "Şəki-Zaqatala", lat: 41.071, lon: 47.465, elevationM: 649.0, irrigation: "rainfed", defaultPh: 6.6, defaultTexture: "loam", meanTempC: 12.4, annualRainMm: 555.9, humidityPct: 66.6, windMs: 1.2, nasaValidDays: 366 },
  { id: "ordubad", nameEn: "Ordubad", nameAz: "Ordubad", economicRegionEn: "Nakhchivan", economicRegionAz: "Naxçıvan", lat: 38.908, lon: 46.028, elevationM: 888.0, irrigation: "irrigated", defaultPh: 7.3, defaultTexture: "loam", meanTempC: 8.6, annualRainMm: 432.4, humidityPct: 68.6, windMs: 2.1, nasaValidDays: 366 },
  { id: "saatli", nameEn: "Saatli", nameAz: "Saatlı", economicRegionEn: "Mil-Mughan", economicRegionAz: "Mil-Muğan", lat: 39.932, lon: 48.369, elevationM: -8.0, irrigation: "irrigated", defaultPh: 7.6, defaultTexture: "clay", meanTempC: 17.5, annualRainMm: 390.7, humidityPct: 62.1, windMs: 1.8, nasaValidDays: 366 },
  { id: "sabirabad", nameEn: "Sabirabad", nameAz: "Sabirabad", economicRegionEn: "Mil-Mughan", economicRegionAz: "Mil-Muğan", lat: 40.009, lon: 48.477, elevationM: -12.0, irrigation: "irrigated", defaultPh: 7.6, defaultTexture: "clay", meanTempC: 16.8, annualRainMm: 423.5, humidityPct: 64.3, windMs: 2.4, nasaValidDays: 366 },
  { id: "salyan", nameEn: "Salyan", nameAz: "Salyan", economicRegionEn: "Shirvan-Salyan", economicRegionAz: "Şirvan-Salyan", lat: 39.596, lon: 48.985, elevationM: -15.0, irrigation: "irrigated", defaultPh: 7.6, defaultTexture: "clay", meanTempC: 17.2, annualRainMm: 474.2, humidityPct: 68.3, windMs: 2.5, nasaValidDays: 366 },
  { id: "samukh", nameEn: "Samukh", nameAz: "Samux", economicRegionEn: "Ganja-Dashkasan", economicRegionAz: "Gəncə-Daşkəsən", lat: 40.765, lon: 46.409, elevationM: 247.0, irrigation: "irrigated", defaultPh: 7.1, defaultTexture: "loam", meanTempC: 15.5, annualRainMm: 605.2, humidityPct: 64.1, windMs: 1.9, nasaValidDays: 366 },
  { id: "sadarak", nameEn: "Sadarak", nameAz: "Sədərək", economicRegionEn: "Nakhchivan", economicRegionAz: "Naxçıvan", lat: 39.714, lon: 44.886, elevationM: 862.0, irrigation: "irrigated", defaultPh: 7.5, defaultTexture: "loam", meanTempC: 12.8, annualRainMm: 436.9, humidityPct: 55.5, windMs: 1.6, nasaValidDays: 366 },
  { id: "siyazan", nameEn: "Siyazan", nameAz: "Siyəzən", economicRegionEn: "Quba-Khachmaz", economicRegionAz: "Quba-Xaçmaz", lat: 41.076, lon: 49.112, elevationM: 57.0, irrigation: "irrigated", defaultPh: 7.1, defaultTexture: "clay", meanTempC: 15.9, annualRainMm: 430.4, humidityPct: 69.6, windMs: 4.1, nasaValidDays: 366 },
  { id: "shabran", nameEn: "Shabran", nameAz: "Şabran", economicRegionEn: "Quba-Khachmaz", economicRegionAz: "Quba-Xaçmaz", lat: 41.201, lon: 48.987, elevationM: 46.0, irrigation: "irrigated", defaultPh: 7.0, defaultTexture: "clay", meanTempC: 9.5, annualRainMm: 496.5, humidityPct: 72.8, windMs: 2.3, nasaValidDays: 366 },
  { id: "shahbuz", nameEn: "Shahbuz", nameAz: "Şahbuz", economicRegionEn: "Nakhchivan", economicRegionAz: "Naxçıvan", lat: 39.407, lon: 45.574, elevationM: 1200.0, irrigation: "rainfed", defaultPh: 6.6, defaultTexture: "loam", meanTempC: 8.7, annualRainMm: 506.3, humidityPct: 64.3, windMs: 1.8, nasaValidDays: 366 },
  { id: "shamakhi", nameEn: "Shamakhi", nameAz: "Şamaxı", economicRegionEn: "Mountainous Shirvan", economicRegionAz: "Dağlıq Şirvan", lat: 40.631, lon: 48.641, elevationM: 693.0, irrigation: "rainfed", defaultPh: 6.9, defaultTexture: "loam", meanTempC: 14.0, annualRainMm: 454.7, humidityPct: 65.0, windMs: 1.8, nasaValidDays: 366 },
  { id: "shaki", nameEn: "Shaki", nameAz: "Şəki", economicRegionEn: "Shaki-Zagatala", economicRegionAz: "Şəki-Zaqatala", lat: 41.192, lon: 47.171, elevationM: 553.0, irrigation: "rainfed", defaultPh: 6.7, defaultTexture: "loam", meanTempC: 15.6, annualRainMm: 588.5, humidityPct: 65.1, windMs: 2.1, nasaValidDays: 366 },
  { id: "shamkir", nameEn: "Shamkir", nameAz: "Şəmkir", economicRegionEn: "Ganja-Dashkasan", economicRegionAz: "Gəncə-Daşkəsən", lat: 40.829, lon: 46.019, elevationM: 457.0, irrigation: "irrigated", defaultPh: 6.9, defaultTexture: "loam", meanTempC: 15.5, annualRainMm: 605.2, humidityPct: 64.1, windMs: 1.9, nasaValidDays: 366 },
  { id: "sharur", nameEn: "Sharur", nameAz: "Şərur", economicRegionEn: "Nakhchivan", economicRegionAz: "Naxçıvan", lat: 39.553, lon: 44.98, elevationM: 810.0, irrigation: "irrigated", defaultPh: 7.5, defaultTexture: "loam", meanTempC: 12.8, annualRainMm: 436.9, humidityPct: 55.5, windMs: 1.6, nasaValidDays: 366 },
  { id: "shusha", nameEn: "Shusha", nameAz: "Şuşa", economicRegionEn: "Karabakh", economicRegionAz: "Qarabağ", lat: 39.76, lon: 46.747, elevationM: 1342.0, irrigation: "rainfed", defaultPh: 6.5, defaultTexture: "loam", meanTempC: 13.9, annualRainMm: 485.0, humidityPct: 63.2, windMs: 1.6, nasaValidDays: 366 },
  { id: "tartar", nameEn: "Tartar", nameAz: "Tərtər", economicRegionEn: "Karabakh", economicRegionAz: "Qarabağ", lat: 40.345, lon: 46.929, elevationM: 246.0, irrigation: "irrigated", defaultPh: 7.2, defaultTexture: "loam", meanTempC: 15.7, annualRainMm: 457.6, humidityPct: 60.5, windMs: 2.3, nasaValidDays: 366 },
  { id: "tovuz", nameEn: "Tovuz", nameAz: "Tovuz", economicRegionEn: "Gazakh-Tovuz", economicRegionAz: "Qazax-Tovuz", lat: 40.992, lon: 45.628, elevationM: 421.0, irrigation: "irrigated", defaultPh: 6.9, defaultTexture: "loam", meanTempC: 13.5, annualRainMm: 612.7, humidityPct: 66.3, windMs: 1.8, nasaValidDays: 366 },
  { id: "ujar", nameEn: "Ujar", nameAz: "Ucar", economicRegionEn: "Central Aran", economicRegionAz: "Mərkəzi Aran", lat: 40.519, lon: 47.654, elevationM: 15.0, irrigation: "irrigated", defaultPh: 7.4, defaultTexture: "clay", meanTempC: 17.4, annualRainMm: 458.0, humidityPct: 60.1, windMs: 1.9, nasaValidDays: 366 },
  { id: "yardimli", nameEn: "Yardimli", nameAz: "Yardımlı", economicRegionEn: "Lankaran-Astara", economicRegionAz: "Lənkəran-Astara", lat: 38.907, lon: 48.241, elevationM: 727.0, irrigation: "rainfed", defaultPh: 6.4, defaultTexture: "loam", meanTempC: 12.4, annualRainMm: 724.6, humidityPct: 70.7, windMs: 2.0, nasaValidDays: 366 },
  { id: "yevlakh", nameEn: "Yevlakh", nameAz: "Yevlax", economicRegionEn: "Central Aran", economicRegionAz: "Mərkəzi Aran", lat: 40.618, lon: 47.15, elevationM: 16.0, irrigation: "irrigated", defaultPh: 7.4, defaultTexture: "loam", meanTempC: 15.7, annualRainMm: 457.6, humidityPct: 60.5, windMs: 2.3, nasaValidDays: 366 },
  { id: "zagatala", nameEn: "Zagatala", nameAz: "Zaqatala", economicRegionEn: "Shaki-Zagatala", economicRegionAz: "Şəki-Zaqatala", lat: 41.632, lon: 46.643, elevationM: 495.0, irrigation: "rainfed", defaultPh: 6.5, defaultTexture: "loam", meanTempC: 10.3, annualRainMm: 766.9, humidityPct: 71.8, windMs: 1.1, nasaValidDays: 366 },
  { id: "zangilan", nameEn: "Zangilan", nameAz: "Zəngilan", economicRegionEn: "East Zangezur", economicRegionAz: "Şərqi Zəngəzur", lat: 39.065, lon: 46.697, elevationM: 371.0, irrigation: "irrigated", defaultPh: 7.0, defaultTexture: "loam", meanTempC: 12.6, annualRainMm: 427.0, humidityPct: 62.9, windMs: 2.0, nasaValidDays: 366 },
  { id: "zardab", nameEn: "Zardab", nameAz: "Zərdab", economicRegionEn: "Central Aran", economicRegionAz: "Mərkəzi Aran", lat: 40.219, lon: 47.712, elevationM: -4.0, irrigation: "irrigated", defaultPh: 7.5, defaultTexture: "clay", meanTempC: 17.3, annualRainMm: 400.0, humidityPct: 61.1, windMs: 1.9, nasaValidDays: 366 },
];

export function findAzDistrict(idOrName: string | null | undefined): AzDistrictRecord | null {
  if (!idOrName) return null;
  const clean = idOrName.trim().toLowerCase().replace(/^az-/, "");
  return (
    AZ_DISTRICTS.find(
      (d) =>
        d.id === clean ||
        d.nameEn.toLowerCase() === clean ||
        d.nameAz.toLowerCase() === clean,
    ) ?? null
  );
}

export function createPresetFromAzDistrict(district: AzDistrictRecord): VerifiedRegionPreset {
  const base = VERIFIED_AZ_REGIONS[0];
  return {
    ...base,
    id: district.id,
    nameEn: `${district.nameEn} (${district.economicRegionEn})`,
    nameAz: `${district.nameAz} (${district.economicRegionAz})`,
    latitude: district.lat,
    longitude: district.lon,
    hasBoundary: false,
    irrigationType: district.irrigation,
    irrigationBudgetMm: district.irrigation === "irrigated" ? 260 : null,
    ph: district.defaultPh,
    texture: district.defaultTexture,
    soilSourceType: "user_reported",
    soilSourceRef: `AZ-AGRO-NASA-${district.id.toUpperCase()}`,
    snapshotNoteEn: `NASA POWER 2024 (${district.meanTempC.toFixed(1)} °C · ${district.annualRainMm.toFixed(1)} mm/yr) & SRTM 90m DEM (${district.elevationM.toFixed(0)} m).`,
    snapshotNoteAz: `NASA POWER 2024 (${district.meanTempC.toFixed(1)} °C · ${district.annualRainMm.toFixed(1)} mm/il) və SRTM 90m DEM (${district.elevationM.toFixed(0)} m).`,
  };
}

export function createDraftFromAzDistrict(
  district: AzDistrictRecord,
  locale: "az" | "en" = "az",
): FieldDraft {
  const base = createDraftFromRegion(VERIFIED_AZ_REGIONS[0]);
  return {
    ...base,
    regionPresetId: district.id,
    farmId: `az-district-${district.id}`,
    label:
      locale === "az"
        ? `${district.nameAz} Sahə (${district.economicRegionAz})`
        : `${district.nameEn} Field (${district.economicRegionEn})`,
    hasBoundary: false,
    boundaryPolygon: null,
    latitude: district.lat,
    longitude: district.lon,
    areaHa: 25,
    irrigationType: district.irrigation,
    irrigationBudgetMm: district.irrigation === "irrigated" ? 260 : 0,
    soilPhKnown: true,
    soilPh: district.defaultPh,
    soilTexture: district.defaultTexture,
    soilSourceType: "user_reported",
    soilSourceRef: `AZ-AGRO-NASA-${district.id.toUpperCase()}`,
    priorCropId: "wheat",
  };
}

export function resolveRegionPresetOrDistrict(
  id: string | null | undefined,
): VerifiedRegionPreset | null {
  if (!id) return null;
  const primary = VERIFIED_AZ_REGIONS.find((r) => r.id === id);
  if (primary) return primary;
  const district = findAzDistrict(id);
  return district ? createPresetFromAzDistrict(district) : null;
}
