import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { ORBITAL_PRESETS } from "../data/presets";
import {
  buildRealOrbitVectors,
  latLonToSceneVec3,
  propagateSatelliteOrbit,
  sampleWindField,
  stitchNasaGibsTexture,
  stitchRegionalHighResPatch,
} from "../services/realTelemetry";
import type {
  ActiveSatelliteId,
  EarthCameraMode,
  RealSatelliteTelemetry,
  RealWindGridPoint,
  SatelliteFilterMode,
  SatellitePovStyle,
  SatelliteTleRecord,
} from "../types";

export interface EarthSatelliteCanvasProps {
  selectedLat: number;
  selectedLon: number;
  selectedPresetId: string | null;
  filterMode: SatelliteFilterMode;
  cameraMode: EarthCameraMode;
  satPovStyle: SatellitePovStyle;
  activeSatelliteId: ActiveSatelliteId;
  satelliteTle: SatelliteTleRecord;
  satOverflyTarget: boolean;
  windGrid: RealWindGridPoint[];
  isDiving: boolean;
  isPaused?: boolean;
  language: "en" | "az";
  onSelectLocation: (lat: number, lon: number, presetId: string | null, label?: string) => void;
  onRequestDive?: (lat: number, lon: number, presetId: string | null, label?: string) => void;
  onEnterSatellitePov?: () => void;
  onTelemetryUpdate?: (telemetry: RealSatelliteTelemetry) => void;
  onDiveProgress?: (altitudeKm: number, progress: number) => void;
  onDiveComplete?: () => void;
}

const EARTH_RADIUS = 1.0;

function sceneVec3ToLatLon(vec: THREE.Vector3): { lat: number; lon: number } {
  const n = vec.clone().normalize();
  const lat = 90 - (Math.acos(Math.max(-1, Math.min(1, n.y))) * 180) / Math.PI;
  const rawDeg = (Math.atan2(n.z, -n.x) * 180) / Math.PI - 180;
  let lon = ((rawDeg + 180) % 360 + 360) % 360 - 180;
  if (lon < -180) lon += 360;
  return { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) };
}

function buildSurfaceReticleRing(lat: number, lon: number, radiusDeg = 0.9): THREE.Vector3[] {
  const center = latLonToSceneVec3(lat, lon, EARTH_RADIUS * 1.003);
  const up = center.clone().normalize();
  const ref = Math.abs(up.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(ref, up).normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  const rScene = (radiusDeg * Math.PI) / 180;
  const pts: THREE.Vector3[] = [];
  const segs = 64;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const p = center
      .clone()
      .addScaledVector(east, Math.cos(a) * rScene)
      .addScaledVector(north, Math.sin(a) * rScene)
      .normalize()
      .multiplyScalar(EARTH_RADIUS * 1.0035);
    pts.push(p);
  }
  return pts;
}

function createProceduralStars(count = 2400): THREE.Points {
  const pos = new Float32Array(count * 3);
  const cols = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 32 + Math.random() * 28;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const tint = Math.random();
    const bright = 0.55 + Math.random() * 0.45;
    if (tint > 0.85) {
      cols[i * 3] = 0.72 * bright;
      cols[i * 3 + 1] = 0.65 * bright;
      cols[i * 3 + 2] = 1.0 * bright;
    } else if (tint > 0.68) {
      cols[i * 3] = 0.75 * bright;
      cols[i * 3 + 1] = 0.88 * bright;
      cols[i * 3 + 2] = 1.0 * bright;
    } else {
      cols[i * 3] = bright;
      cols[i * 3 + 1] = bright;
      cols[i * 3 + 2] = bright;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.085,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    sizeAttenuation: true,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

function createHeroConstellationNet(): THREE.LineSegments {
  const nodes: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 6.5 + Math.random() * 8.5;
    nodes.push(
      new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      )
    );
  }
  const verts: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = nodes[i].distanceTo(nodes[j]);
      if (d < 4.4) {
        verts.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x8b5cf6,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  return new THREE.LineSegments(geo, mat);
}

let cachedBeaconAuraTex: THREE.CanvasTexture | null = null;

function getBeaconAuraTexture(): THREE.CanvasTexture {
  if (cachedBeaconAuraTex) return cachedBeaconAuraTex;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.22, "rgba(56, 189, 248, 0.92)");
  grad.addColorStop(0.52, "rgba(168, 85, 247, 0.55)");
  grad.addColorStop(0.82, "rgba(139, 92, 246, 0.14)");
  grad.addColorStop(1.0, "rgba(139, 92, 246, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  cachedBeaconAuraTex = new THREE.CanvasTexture(canvas);
  return cachedBeaconAuraTex;
}

/**
 * Sleek NASA Orbital Telemetry Beacon Node (replaces 3D CAD mesh per user preference).
 * Renders a luminous core telemetry orb, radial plasma aura, and concentric target rings
 * that billboard cleanly toward the camera in Orbit view.
 */
function createOrbitalTelemetryBeacon(): THREE.Group {
  const beacon = new THREE.Group();
  beacon.name = "__sat_beacon__";

  // 1. Radiant white-cyan telemetry core sphere
  const coreGeo = new THREE.SphereGeometry(0.013, 24, 24);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
  });
  beacon.add(new THREE.Mesh(coreGeo, coreMat));

  // 2. Soft additive plasma halo sprite
  const spriteMat = new THREE.SpriteMaterial({
    map: getBeaconAuraTexture(),
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const auraSprite = new THREE.Sprite(spriteMat);
  auraSprite.scale.set(0.115, 0.115, 1);
  beacon.add(auraSprite);

  // 3. Inner cyan sensor lock ring
  const innerRingGeo = new THREE.RingGeometry(0.023, 0.0265, 48);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  beacon.add(new THREE.Mesh(innerRingGeo, innerRingMat));

  // 4. Outer SpaceFarm violet telemetry ring
  const outerRingGeo = new THREE.RingGeometry(0.038, 0.041, 64);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: 0xc084fc,
    transparent: true,
    opacity: 0.52,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  beacon.add(new THREE.Mesh(outerRingGeo, outerRingMat));

  return beacon;
}

const EARTH_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;

  void main() {
    vUv = uv;
    vLocalPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const EARTH_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uDayMap;
  uniform sampler2D uRegionDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uWaterMask;
  uniform sampler2D uTopoMap;
  uniform sampler2D uCloudMap;
  uniform sampler2D uThermalMap;
  uniform sampler2D uNdviMap;
  uniform float uHasRegionDay;
  uniform float uHasTopo;
  uniform float uHasThermal;
  uniform float uHasNdvi;
  uniform vec3 uSunDir;
  uniform float uFilterMode; // 0: normal, 1: thermal, 2: wind, 3: ndvi
  uniform float uTime;
  uniform float uCloudRot;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float microNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbmDetail(vec2 uv) {
    float n1 = microNoise(uv * vec2(1200.0, 600.0));
    float n2 = microNoise(uv * vec2(2600.0, 1300.0));
    return (n1 * 0.65 + n2 * 0.35) - 0.5;
  }

  vec3 perturbReliefNormal(vec3 N, vec3 P, vec2 uv) {
    if (uHasTopo < 0.5) return N;
    vec2 texel = vec2(1.0 / 2560.0, 1.0 / 1280.0);
    float micro = fbmDetail(uv) * 0.068;
    float hC = texture2D(uTopoMap, uv).r + micro;
    float hR = texture2D(uTopoMap, uv + vec2(texel.x, 0.0)).r + fbmDetail(uv + vec2(texel.x, 0.0)) * 0.068;
    float hU = texture2D(uTopoMap, uv + vec2(0.0, texel.y)).r + fbmDetail(uv + vec2(0.0, texel.y)) * 0.068;

    vec3 dPdx = dFdx(P);
    vec3 dPdy = dFdy(P);
    vec2 dUVdx = dFdx(uv);
    vec2 dUVdy = dFdy(uv);

    vec3 r1 = cross(dPdy, N);
    vec3 r2 = cross(N, dPdx);
    float det = dot(dPdx, r1);
    if (abs(det) < 1e-6) return N;

    float dHdx = (hR - hC) * 5.4;
    float dHdy = (hU - hC) * 5.4;
    vec3 surfGrad = sign(det) * (dHdx * (dUVdy.y * r1 - dUVdx.y * r2) + dHdy * (-dUVdy.x * r1 + dUVdx.x * r2));
    float scale = (1.0 - max(0.0, texture2D(uWaterMask, uv).r)) * 0.78;
    return normalize(abs(det) * N - scale * surfGrad);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    vec3 reliefN = perturbReliefNormal(N, vWorldPos, vUv);

    vec3 dayTex = texture2D(uDayMap, vUv).rgb;
    // Blend 500m NASA GIBS z=5 regional high-resolution patch over [18°E..54°E, 18°N..54°N]
    if (uHasRegionDay > 0.5 && vUv.x > 0.55 && vUv.x < 0.65 && vUv.y > 0.60 && vUv.y < 0.80) {
      vec2 regUv = vec2((vUv.x - 0.55) / 0.10, (vUv.y - 0.60) / 0.20);
      vec2 edge = min(regUv, 1.0 - regUv);
      float regWeight = smoothstep(0.0, 0.06, min(edge.x, edge.y));
      vec3 regColor = texture2D(uRegionDayMap, clamp(regUv, 0.0, 1.0)).rgb;
      dayTex = mix(dayTex, regColor, regWeight);
    }

    vec3 nightTex = texture2D(uNightMap, vUv).rgb;
    float waterMask = texture2D(uWaterMask, vUv).r;
    float topoVal = texture2D(uTopoMap, vUv).r;
    float landMask = clamp(1.0 - waterMask, 0.0, 1.0);
    float fineGrain = fbmDetail(vUv) * 0.065 * landMask;
    dayTex = clamp(dayTex * (1.0 + fineGrain), 0.0, 1.0);

    // Cloud shadow casting onto surface below for orbital 3D depth
    vec2 cloudShadowUv = vec2(fract(vUv.x - uCloudRot - 0.0024), clamp(vUv.y - 0.0018, 0.0, 1.0));
    float cloudShadow = texture2D(uCloudMap, cloudShadowUv).r;
    float rawSun = dot(N, L);
    float bumpedSun = dot(reliefN, L);
    float dayFactor = smoothstep(-0.18, 0.24, rawSun);

    // Rich sunlit continents + soft orbital cloud shadows + ocean specular highlight
    float shadowAtten = 1.0 - cloudShadow * 0.24 * dayFactor;
    vec3 baseDay = dayTex * (0.46 + 0.94 * max(0.0, bumpedSun)) * shadowAtten;
    vec3 halfVec = normalize(L + V);
    float specPow = mix(22.0, 68.0, waterMask);
    float spec = pow(max(0.0, dot(reliefN, halfVec)), specPow) * mix(0.08, 0.52, waterMask) * dayFactor * shadowAtten;

    vec3 nightSide = dayTex * 0.08 + nightTex * vec3(1.12, 0.9, 1.42) * 1.22;
    vec3 normalColor = mix(nightSide, baseDay, dayFactor) + vec3(0.45, 0.62, 0.98) * spec;

    // Vivid cosmic twilight purple atmospheric bounce
    float twilight = exp(-abs(rawSun) * 8.2) * 0.18;
    normalColor += vec3(0.56, 0.26, 0.94) * twilight;

    vec3 finalColor = normalColor;

    if (uFilterMode > 0.5 && uFilterMode < 1.5) {
      // Real MODIS LST + Live Open-Meteo Thermal Surface Map with 3D topographic relief & isotherms
      vec3 thermTex = uHasThermal > 0.5 ? texture2D(uThermalMap, vUv).rgb : mix(vec3(0.2, 0.15, 0.7), vec3(1.0, 0.45, 0.12), 0.5);
      float reliefShade = 0.58 + 0.58 * max(0.0, bumpedSun) + 0.22 * topoVal + fineGrain * 0.8;
      vec3 litThermal = thermTex * mix(0.66, reliefShade, 0.76);
      float lum = dot(thermTex, vec3(0.299, 0.587, 0.114));
      float contour = smoothstep(0.93, 1.0, abs(sin(lum * 32.0)));
      float coastEdge = abs(dFdx(waterMask)) + abs(dFdy(waterMask));
      finalColor = mix(normalColor * 0.24, litThermal, 0.88)
        + vec3(1.0, 0.90, 0.75) * contour * 0.18
        + vec3(0.38, 0.82, 1.0) * min(1.0, coastEdge * 5.0) * 0.22;
    } else if (uFilterMode > 1.5 && uFilterMode < 2.5) {
      // Wind Streamlines filter: high-contrast synoptic dark-indigo globe with glowing coastline vectors
      float coastEdge = abs(dFdx(waterMask)) + abs(dFdy(waterMask));
      float topoEdge = (abs(dFdx(topoVal)) + abs(dFdy(topoVal))) * landMask;
      vec3 darkBase = normalColor * 0.46 + vec3(0.03, 0.05, 0.15) * 0.54;
      finalColor = darkBase
        + vec3(0.46, 0.38, 0.92) * min(1.0, coastEdge * 6.0) * 0.48
        + vec3(0.22, 0.65, 0.95) * min(1.0, topoEdge * 10.0) * 0.22;
    } else if (uFilterMode > 2.5) {
      // Real NASA MODIS 16-Day NDVI Crop Vegetation Index with topographic relief & chlorophyll bands
      vec3 ndviTex = uHasNdvi > 0.5 ? texture2D(uNdviMap, vUv).rgb : vec3(0.1, 0.45, 0.22);
      float isOcean = smoothstep(0.35, 0.75, waterMask);
      float relief = 0.66 + 0.54 * max(0.0, bumpedSun) + fineGrain * 0.9;
      float vegBand = smoothstep(0.94, 1.0, abs(sin(ndviTex.g * 26.0))) * landMask;
      vec3 cropVis = mix(ndviTex * relief + vec3(0.18, 0.95, 0.52) * vegBand * 0.12, normalColor * 0.35, isOcean * 0.88);
      finalColor = mix(normalColor * 0.22, cropVis, 0.92);
    }

    // Crisp orbital Rayleigh + purple astral limb Fresnel glow
    float fresnel = pow(clamp(1.0 - max(0.0, dot(N, V)), 0.0, 1.0), 3.2);
    vec3 limbColor = mix(vec3(0.32, 0.62, 1.0), vec3(0.68, 0.28, 1.0), 0.62);
    finalColor += limbColor * fresnel * mix(0.42, 0.78, dayFactor);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const EarthSatelliteCanvas: React.FC<EarthSatelliteCanvasProps> = ({
  selectedLat,
  selectedLon,
  selectedPresetId,
  filterMode,
  cameraMode,
  satPovStyle,
  activeSatelliteId,
  satelliteTle,
  satOverflyTarget,
  windGrid,
  isDiving,
  isPaused = false,
  language,
  onSelectLocation,
  onRequestDive,
  onEnterSatellitePov,
  onTelemetryUpdate,
  onDiveProgress,
  onDiveComplete,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const reticleRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const selectedReticleRef = useRef<HTMLDivElement | null>(null);
  const satHintRef = useRef<HTMLDivElement | null>(null);

  const [hdReady, setHdReady] = useState(false);
  const [regionHdReady, setRegionHdReady] = useState(false);
  const [thermalReady, setThermalReady] = useState(false);
  const [satHovered, setSatHovered] = useState(false);

  const satPovLookRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const smoothLookRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });

  const propsRef = useRef({
    selectedLat,
    selectedLon,
    filterMode,
    cameraMode,
    satPovStyle,
    activeSatelliteId,
    satelliteTle,
    satOverflyTarget,
    windGrid,
    isDiving,
    isPaused,
    onSelectLocation,
    onRequestDive,
    onEnterSatellitePov,
    onTelemetryUpdate,
    onDiveProgress,
    onDiveComplete,
  });
  propsRef.current = {
    selectedLat,
    selectedLon,
    filterMode,
    cameraMode,
    satPovStyle,
    activeSatelliteId,
    satelliteTle,
    satOverflyTarget,
    windGrid,
    isDiving,
    isPaused,
    onSelectLocation,
    onRequestDive,
    onEnterSatellitePov,
    onTelemetryUpdate,
    onDiveProgress,
    onDiveComplete,
  };

  // Focus camera fly target whenever user clicks a preset or toggles back to orbit
  const flyRef = useRef<{
    active: boolean;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    progress: number;
  }>({
    active: false,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    progress: 0,
  });

  // High-speed Dive animation state
  const diveRef = useRef<{
    started: boolean;
    finished: boolean;
    elapsed: number;
    duration: number;
    startPos: THREE.Vector3;
    startUp: THREE.Vector3;
  }>({
    started: false,
    finished: false,
    elapsed: 0,
    duration: 1.25,
    startPos: new THREE.Vector3(),
    startUp: new THREE.Vector3(0, 1, 0),
  });

  const sceneObjectsRef = useRef<{
    earthMat?: THREE.ShaderMaterial;
    targetRing?: THREE.LineLoop;
    satHolder?: THREE.Group;
    orbitLine?: THREE.Line;
    windSegments?: THREE.LineSegments;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
  }>({});

  // Trigger camera glide when preset/coordinates change in Orbit mode
  const prevCoordRef = useRef(`${selectedLat.toFixed(2)},${selectedLon.toFixed(2)}`);
  useEffect(() => {
    const key = `${selectedLat.toFixed(2)},${selectedLon.toFixed(2)}`;
    if (key !== prevCoordRef.current) {
      prevCoordRef.current = key;
      const { camera } = sceneObjectsRef.current;
      if (camera && propsRef.current.cameraMode === "orbit" && !propsRef.current.isDiving) {
        const curDist = Math.max(2.05, Math.min(3.35, camera.position.length()));
        flyRef.current = {
          active: true,
          startPos: camera.position.clone(),
          endPos: latLonToSceneVec3(selectedLat, selectedLon, curDist),
          progress: 0,
        };
      }
    }
    // Update subtle surface reticle ring
    const ring = sceneObjectsRef.current.targetRing;
    if (ring) {
      ring.geometry.dispose();
      ring.geometry = new THREE.BufferGeometry().setFromPoints(
        buildSurfaceReticleRing(selectedLat, selectedLon, 1.05)
      );
    }
  }, [selectedLat, selectedLon]);

  // Manage controls & camera transitions cleanly when toggling Orbit <-> Satellite POV
  useEffect(() => {
    const { camera, controls } = sceneObjectsRef.current;
    satPovLookRef.current = { yaw: 0, pitch: 0 };
    smoothLookRef.current = { yaw: 0, pitch: 0 };
    if (cameraMode === "satellite") {
      if (controls) controls.enabled = false;
      if (camera) {
        camera.near = 0.002;
        camera.updateProjectionMatrix();
      }
      setSatHovered(false);
    } else if (!isDiving) {
      if (controls) controls.enabled = true;
      if (camera) {
        camera.near = 0.015;
        camera.fov = 42;
        camera.updateProjectionMatrix();
        if (camera.position.length() < 1.85) {
          flyRef.current = {
            active: true,
            startPos: camera.position.clone(),
            endPos: latLonToSceneVec3(propsRef.current.selectedLat, propsRef.current.selectedLon, 2.58),
            progress: 0,
          };
        }
      }
    }
  }, [cameraMode, satPovStyle, isDiving]);

  // Reset & start dive state when isDiving toggles true
  useEffect(() => {
    const { camera, controls } = sceneObjectsRef.current;
    if (isDiving && camera) {
      diveRef.current = {
        started: true,
        finished: false,
        elapsed: 0,
        duration: 1.28,
        startPos: camera.position.clone(),
        startUp: camera.up.clone(),
      };
      if (controls) controls.enabled = false;
    } else if (!isDiving) {
      diveRef.current.started = false;
      diveRef.current.finished = false;
      if (camera) {
        camera.fov = 42;
        camera.up.set(0, 1, 0);
        camera.updateProjectionMatrix();
        if (camera.position.length() < 1.55) {
          camera.position.copy(
            latLonToSceneVec3(propsRef.current.selectedLat, propsRef.current.selectedLon, 2.55)
          );
          camera.lookAt(0, 0, 0);
        }
      }
      if (controls) controls.enabled = true;
    }
  }, [isDiving]);

  // Sync shader filter uniform & wind visibility immediately
  useEffect(() => {
    const { earthMat, windSegments } = sceneObjectsRef.current;
    if (earthMat) {
      const modeMap: Record<SatelliteFilterMode, number> = {
        normal: 0,
        thermal: 1,
        wind: 2,
        ndvi: 3,
      };
      earthMat.uniforms.uFilterMode.value = modeMap[filterMode];
    }
    if (windSegments) {
      windSegments.visible = filterMode === "wind";
    }
  }, [filterMode]);

  // Upgrade MODIS Thermal texture once real windGrid thermal backdrop arrives
  useEffect(() => {
    const mat = sceneObjectsRef.current.earthMat;
    if (!mat || windGrid.length === 0) return;
    let cancelled = false;
    stitchNasaGibsTexture("thermal", 4096, windGrid).then((tex) => {
      if (cancelled) return;
      mat.uniforms.uThermalMap.value = tex;
      mat.uniforms.uHasThermal.value = 1.0;
      setThermalReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [windGrid.length]);

  // Main Three.js Scene setup & animation loop
  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 640;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03030a);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.015, 160);
    const initialCamPos = latLonToSceneVec3(
      propsRef.current.selectedLat,
      propsRef.current.selectedLon,
      2.62
    );
    camera.position.copy(initialCamPos);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    const maxTexSize = renderer.capabilities?.maxTextureSize || 4096;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 1.24;
    controls.maxDistance = 5.4;
    controls.rotateSpeed = 0.56;
    controls.zoomSpeed = 0.78;
    controls.autoRotate = false;

    // Orbital solar & atmospheric rim lighting for Earth
    const sunDir = new THREE.Vector3(3.6, 1.4, 2.2).normalize();
    const sunLight = new THREE.DirectionalLight(0xfff6e8, 2.55);
    sunLight.position.copy(sunDir).multiplyScalar(12);
    scene.add(sunLight);

    const earthShine = new THREE.DirectionalLight(0x4f7df3, 0.72);
    earthShine.position.set(-4, -2, -3);
    scene.add(earthShine);

    const astralRim = new THREE.DirectionalLight(0xa855f7, 0.85);
    astralRim.position.set(-2.5, 4.0, -4.0);
    scene.add(astralRim);

    const ambient = new THREE.AmbientLight(0x282442, 0.85);
    scene.add(ambient);

    // Procedural starfield & subtle purple orbital constellation mesh
    const stars = createProceduralStars(2600);
    scene.add(stars);
    const constellationNet = createHeroConstellationNet();
    scene.add(constellationNet);

    // Earth Textures (fast CDN immediate -> async upgrade to NASA 5K GIBS + 500m regional patch)
    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin("anonymous");

    const dayFallback = texLoader.load(
      "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg",
      (t) => {
        t.encoding = THREE.sRGBEncoding;
        t.anisotropy = 16;
      }
    );
    const nightTex = texLoader.load(
      "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg",
      (t) => {
        t.encoding = THREE.sRGBEncoding;
      }
    );
    const waterTex = texLoader.load(
      "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png"
    );
    const topoTex = texLoader.load(
      "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png",
      () => {
        earthMat.uniforms.uHasTopo.value = 1.0;
      }
    );
    const cloudsTex = texLoader.load(
      "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png",
      (t) => {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
        t.anisotropy = 12;
      }
    );

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 160, 160);
    const earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERTEX_SHADER,
      fragmentShader: EARTH_FRAGMENT_SHADER,
      extensions: { derivatives: true },
      uniforms: {
        uDayMap: { value: dayFallback },
        uRegionDayMap: { value: dayFallback },
        uNightMap: { value: nightTex },
        uWaterMask: { value: waterTex },
        uTopoMap: { value: topoTex },
        uCloudMap: { value: cloudsTex },
        uThermalMap: { value: dayFallback },
        uNdviMap: { value: dayFallback },
        uHasRegionDay: { value: 0.0 },
        uHasTopo: { value: 0.0 },
        uHasThermal: { value: 0.0 },
        uHasNdvi: { value: 0.0 },
        uSunDir: { value: sunDir },
        uFilterMode: { value: 0.0 },
        uTime: { value: 0.0 },
        uCloudRot: { value: 0.0 },
      },
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // Sunlit high-altitude orbital cloud deck matching Earth shadow projection
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.0085, 96, 96);
    const cloudMat = new THREE.MeshPhongMaterial({
      map: cloudsTex,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      color: 0xf1f5ff,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    scene.add(cloudMesh);

    // Rich purple-blue Rayleigh astral horizon halo (Hero aesthetic continuity)
    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.044, 96, 96);
    const atmoMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vec3 V = normalize(cameraPosition - vW);
          float rim = pow(clamp(0.66 - dot(vN, -V), 0.0, 1.0), 3.1);
          vec3 glow = mix(vec3(0.28, 0.56, 1.0), vec3(0.66, 0.28, 0.98), 0.62);
          gl_FragColor = vec4(glow, rim * 0.68);
        }
      `,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // Hairline orbital surface target reticle ring (zero bulky arrows/spheres!)
    const ringGeo = new THREE.BufferGeometry().setFromPoints(
      buildSurfaceReticleRing(propsRef.current.selectedLat, propsRef.current.selectedLon, 1.05)
    );
    const ringMat = new THREE.LineBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.72,
    });
    const targetRing = new THREE.LineLoop(ringGeo, ringMat);
    scene.add(targetRing);

    // Real SGP4 Orbit Path + Real NASA 3D Spacecraft Holder
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.38,
    });
    const orbitLine = new THREE.Line(new THREE.BufferGeometry(), orbitMat);
    scene.add(orbitLine);

    const satHolder = new THREE.Group();
    const satHitGeo = new THREE.SphereGeometry(0.145, 16, 16);
    const satHitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    });
    const satHitMesh = new THREE.Mesh(satHitGeo, satHitMat);
    satHitMesh.name = "__sat_hitbox__";
    satHolder.add(satHitMesh);
    satHolder.add(createOrbitalTelemetryBeacon());
    scene.add(satHolder);

    let disposed = false;

    // Subtle nadir scan beam cone under orbital telemetry beacon (hairline translucent violet)
    const beamGeo = new THREE.ConeGeometry(0.055, 0.19, 24, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.075,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const nadirBeam = new THREE.Mesh(beamGeo, beamMat);
    scene.add(nadirBeam);

    // Laminar 3D Wind Streamlines (640 particles x 14 trail segments)
    const STREAM_COUNT = 640;
    const TRAIL_STEPS = 14;
    interface WindParticle {
      lat: number;
      lon: number;
      age: number;
      maxAge: number;
      trail: Array<{ lat: number; lon: number; speed: number }>;
    }
    const windParticles: WindParticle[] = [];
    for (let i = 0; i < STREAM_COUNT; i++) {
      const lat = (Math.random() * 2 - 1) * 64;
      const lon = Math.random() * 360 - 180;
      const trail = [];
      for (let t = 0; t <= TRAIL_STEPS; t++) {
        trail.push({ lat, lon, speed: 5 });
      }
      windParticles.push({
        lat,
        lon,
        age: Math.random() * 90,
        maxAge: 75 + Math.random() * 70,
        trail,
      });
    }
    const windPositions = new Float32Array(STREAM_COUNT * TRAIL_STEPS * 2 * 3);
    const windColors = new Float32Array(STREAM_COUNT * TRAIL_STEPS * 2 * 3);
    const windGeo = new THREE.BufferGeometry();
    windGeo.setAttribute("position", new THREE.BufferAttribute(windPositions, 3));
    windGeo.setAttribute("color", new THREE.BufferAttribute(windColors, 3));
    const windMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const windSegments = new THREE.LineSegments(windGeo, windMat);
    windSegments.frustumCulled = false;
    windSegments.visible = propsRef.current.filterMode === "wind";
    scene.add(windSegments);

    sceneObjectsRef.current = {
      earthMat,
      targetRing,
      satHolder,
      orbitLine,
      windSegments,
      camera,
      controls,
    };

    // Progressive async upgrade: 5K NASA GIBS BlueMarble, 500m z=5 Regional Patch, MODIS NDVI & MODIS Thermal
    stitchNasaGibsTexture("bluemarble", maxTexSize).then((hiResTex) => {
      if (disposed) return;
      earthMat.uniforms.uDayMap.value = hiResTex;
      setHdReady(true);
    });
    stitchRegionalHighResPatch().then((regTex) => {
      if (disposed || !regTex) return;
      earthMat.uniforms.uRegionDayMap.value = regTex;
      earthMat.uniforms.uHasRegionDay.value = 1.0;
      setRegionHdReady(true);
    });
    stitchNasaGibsTexture("ndvi", maxTexSize).then((ndviTex) => {
      if (disposed) return;
      earthMat.uniforms.uNdviMap.value = ndviTex;
      earthMat.uniforms.uHasNdvi.value = 1.0;
    });
    if (propsRef.current.windGrid.length > 0) {
      stitchNasaGibsTexture("thermal", maxTexSize, propsRef.current.windGrid).then((tTex) => {
        if (disposed) return;
        earthMat.uniforms.uThermalMap.value = tTex;
        earthMat.uniforms.uHasThermal.value = 1.0;
        setThermalReady(true);
      });
    }

    // Raycast hover, single-click select, Satellite POV look drag, and double-click navigation
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: e0Fallback() };
    function e0Fallback() {
      return 0;
    }
    let isSatDragging = false;
    let prevSatDragPos = { x: 0, y: 0 };
    let lastTap = { time: 0, x: 0, y: 0, kind: "" as "" | "sat" | "earth" };
    let lastActionMs = 0;

    const updateNdc = (e: MouseEvent | PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
    };

    const hitSpacecraft = (): boolean => {
      const hits = raycaster.intersectObjects(satHolder.children, true);
      return hits.length > 0;
    };

    const triggerSatPov = () => {
      const now = performance.now();
      if (now - lastActionMs < 550) return;
      lastActionMs = now;
      propsRef.current.onEnterSatellitePov?.();
    };

    const triggerEarthDive = (lat: number, lon: number) => {
      const now = performance.now();
      if (now - lastActionMs < 550) return;
      lastActionMs = now;
      propsRef.current.onRequestDive?.(lat, lon, null);
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      if (propsRef.current.cameraMode === "satellite" && !propsRef.current.isDiving) {
        isSatDragging = true;
        prevSatDragPos = { x: e.clientX, y: e.clientY };
        renderer.domElement.style.cursor = "grabbing";
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (propsRef.current.isDiving) return;
      if (isSatDragging && propsRef.current.cameraMode === "satellite") {
        const dx = e.clientX - prevSatDragPos.x;
        const dy = e.clientY - prevSatDragPos.y;
        prevSatDragPos = { x: e.clientX, y: e.clientY };
        satPovLookRef.current.yaw = Math.max(-1.35, Math.min(1.35, satPovLookRef.current.yaw + dx * 0.0038));
        satPovLookRef.current.pitch = Math.max(-0.78, Math.min(0.78, satPovLookRef.current.pitch + dy * 0.0038));
        return;
      }
      if (propsRef.current.cameraMode === "orbit") {
        updateNdc(e);
        const overSat = hitSpacecraft();
        renderer.domElement.style.cursor = overSat ? "pointer" : "grab";
        setSatHovered((prev) => (prev !== overSat ? overSat : prev));
      } else if (propsRef.current.cameraMode === "satellite") {
        renderer.domElement.style.cursor = "grab";
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isSatDragging && propsRef.current.cameraMode === "satellite") {
        renderer.domElement.style.cursor = "grab";
      }
      isSatDragging = false;
      if (propsRef.current.isDiving) return;
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 10) return;
      updateNdc(e);
      const now = performance.now();
      const nearPrev =
        now - lastTap.time < 420 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 22;

      if (propsRef.current.cameraMode === "orbit" && hitSpacecraft()) {
        setSatHovered(true);
        if (nearPrev && lastTap.kind === "sat") {
          lastTap = { time: 0, x: 0, y: 0, kind: "" };
          triggerSatPov();
        } else {
          lastTap = { time: now, x: e.clientX, y: e.clientY, kind: "sat" };
        }
        return;
      }
      const hits = raycaster.intersectObject(earthMesh, false);
      if (hits.length > 0) {
        const { lat, lon } = sceneVec3ToLatLon(hits[0].point);
        propsRef.current.onSelectLocation(lat, lon, null);
        if (nearPrev && lastTap.kind === "earth") {
          lastTap = { time: 0, x: 0, y: 0, kind: "" };
          triggerEarthDive(lat, lon);
        } else {
          lastTap = { time: now, x: e.clientX, y: e.clientY, kind: "earth" };
        }
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      if (propsRef.current.isDiving) return;
      updateNdc(e);
      if (propsRef.current.cameraMode === "orbit" && hitSpacecraft()) {
        triggerSatPov();
        return;
      }
      const hits = raycaster.intersectObject(earthMesh, false);
      if (hits.length > 0) {
        const { lat, lon } = sceneVec3ToLatLon(hits[0].point);
        triggerEarthDive(lat, lon);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("dblclick", onDoubleClick);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // Animation loop
    let animId = 0;
    let prevMs = performance.now();
    let lastOrbitEvalMs = 0;
    let lastTelemetryReportMs = 0;
    const tempVec = new THREE.Vector3();
    const camDirVec = new THREE.Vector3();

    const updateWindBuffer = (dtSec: number) => {
      const grid = propsRef.current.windGrid;
      const posArr = windGeo.attributes.position.array as Float32Array;
      const colArr = windGeo.attributes.color.array as Float32Array;
      let ptr = 0;

      for (let i = 0; i < STREAM_COUNT; i++) {
        const p = windParticles[i];
        p.age += dtSec * 36;
        if (p.age > p.maxAge) {
          p.lat = (Math.random() * 2 - 1) * 62;
          p.lon = Math.random() * 360 - 180;
          p.age = 0;
          for (let t = 0; t <= TRAIL_STEPS; t++) {
            p.trail[t].lat = p.lat;
            p.trail[t].lon = p.lon;
          }
        }

        const wind = sampleWindField(grid, p.lat, p.lon);
        const step = dtSec * 1.12;
        const cosLat = Math.max(0.28, Math.cos((p.lat * Math.PI) / 180));
        p.lon += (wind.uMs * step) / cosLat;
        p.lat += wind.vMs * step;

        if (p.lon > 180) p.lon -= 360;
        if (p.lon < -180) p.lon += 360;
        if (p.lat > 72 || p.lat < -72) {
          p.lat = -p.lat * 0.5;
          for (let t = 0; t <= TRAIL_STEPS; t++) {
            p.trail[t].lat = p.lat;
            p.trail[t].lon = p.lon;
          }
        }

        for (let t = TRAIL_STEPS; t > 0; t--) {
          p.trail[t].lat = p.trail[t - 1].lat;
          p.trail[t].lon = p.trail[t - 1].lon;
          p.trail[t].speed = p.trail[t - 1].speed;
        }
        p.trail[0] = { lat: p.lat, lon: p.lon, speed: wind.speedMs };

        // High-luminance wind speed palette: cyan -> mint -> violet -> magenta
        const sNorm = Math.min(1, wind.speedMs / 24);
        const rBase = Math.min(1.4, (sNorm < 0.5 ? 0.35 + sNorm * 0.3 : 0.55 + sNorm * 0.72) * 1.2);
        const gBase = Math.min(1.4, (sNorm < 0.45 ? 0.92 : 0.95 - (sNorm - 0.45) * 0.85) * 1.2);
        const bBase = Math.min(1.4, (sNorm < 0.7 ? 1.15 : 1.05 - (sNorm - 0.7) * 0.35) * 1.2);

        for (let t = 0; t < TRAIL_STEPS; t++) {
          const a = p.trail[t];
          const b = p.trail[t + 1];
          // Avoid wrapping streaks across dateline or latitude teleportation
          const wrapJump = Math.abs(a.lon - b.lon) > 120 || Math.abs(a.lat - b.lat) > 20;
          const vA = latLonToSceneVec3(a.lat, a.lon, EARTH_RADIUS * 1.018);
          const vB = wrapJump ? vA : latLonToSceneVec3(b.lat, b.lon, EARTH_RADIUS * 1.018);

          posArr[ptr] = vA.x;
          posArr[ptr + 1] = vA.y;
          posArr[ptr + 2] = vA.z;
          posArr[ptr + 3] = vB.x;
          posArr[ptr + 4] = vB.y;
          posArr[ptr + 5] = vB.z;

          const headFade = 1 - t / TRAIL_STEPS;
          const tailFade = Math.max(0.05, 1 - (t + 1) / TRAIL_STEPS);
          colArr[ptr] = rBase * headFade;
          colArr[ptr + 1] = gBase * headFade;
          colArr[ptr + 2] = bBase * headFade;
          colArr[ptr + 3] = rBase * tailFade;
          colArr[ptr + 4] = gBase * tailFade;
          colArr[ptr + 5] = bBase * tailFade;
          ptr += 6;
        }
      }
      windGeo.attributes.position.needsUpdate = true;
      windGeo.attributes.color.needsUpdate = true;
    };

    const projectHtmlReticles = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camDirVec.copy(camera.position).normalize();
      const hideAll = propsRef.current.isDiving && diveRef.current.elapsed > 0.35;

      ORBITAL_PRESETS.forEach((preset) => {
        const el = reticleRefs.current.get(preset.id);
        if (!el) return;
        if (hideAll) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          return;
        }
        const surfaceVec = latLonToSceneVec3(preset.lat, preset.lon, EARTH_RADIUS * 1.005);
        const norm = surfaceVec.clone().normalize();
        const dot = norm.dot(camDirVec);
        if (dot < 0.08) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          return;
        }
        tempVec.copy(surfaceVec).project(camera);
        if (tempVec.z > 1) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          return;
        }
        const sx = (tempVec.x * 0.5 + 0.5) * w;
        const sy = (-tempVec.y * 0.5 + 0.5) * h;
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
        el.style.opacity = String(Math.min(1, (dot - 0.08) * 3.5));
        el.style.pointerEvents = "auto";
      });

      const selEl = selectedReticleRef.current;
      if (selEl) {
        if (hideAll) {
          selEl.style.opacity = "0";
        } else {
          const surfaceVec = latLonToSceneVec3(
            propsRef.current.selectedLat,
            propsRef.current.selectedLon,
            EARTH_RADIUS * 1.006
          );
          const dot = surfaceVec.clone().normalize().dot(camDirVec);
          if (dot < 0.06) {
            selEl.style.opacity = "0";
          } else {
            tempVec.copy(surfaceVec).project(camera);
            const sx = (tempVec.x * 0.5 + 0.5) * w;
            const sy = (-tempVec.y * 0.5 + 0.5) * h;
            selEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
            selEl.style.opacity = "1";
          }
        }
      }
      const satEl = satHintRef.current;
      if (satEl) {
        if (hideAll || propsRef.current.cameraMode === "satellite") {
          satEl.style.visibility = "hidden";
          satEl.style.pointerEvents = "none";
        } else {
          const satWorld = satHolder.position;
          const dot = satWorld.clone().normalize().dot(camDirVec);
          if (dot < -0.15) {
            satEl.style.visibility = "hidden";
            satEl.style.pointerEvents = "none";
          } else {
            tempVec.copy(satWorld).project(camera);
            if (tempVec.z > 1) {
              satEl.style.visibility = "hidden";
            } else {
              const sx = (tempVec.x * 0.5 + 0.5) * w;
              const sy = (-tempVec.y * 0.5 + 0.5) * h - 24;
              satEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
              satEl.style.visibility = "visible";
            }
          }
        }
      }
    };

    const tick = (nowMs: number) => {
      animId = requestAnimationFrame(tick);
      if (propsRef.current.isPaused && !propsRef.current.isDiving) {
        prevMs = nowMs;
        return;
      }
      const dtSec = Math.min(0.05, Math.max(0.004, (nowMs - prevMs) / 1000));
      prevMs = nowMs;

      earthMat.uniforms.uTime.value = nowMs * 0.001;
      cloudMesh.rotation.y += dtSec * 0.0045;
      earthMat.uniforms.uCloudRot.value = cloudMesh.rotation.y / (Math.PI * 2);

      // Update Real SGP4 Satellite Orbit every 100ms
      if (nowMs - lastOrbitEvalMs > 100) {
        lastOrbitEvalMs = nowMs;
        const prop = propagateSatelliteOrbit(propsRef.current.satelliteTle, new Date());
        let renderLat = prop.telemetry.lat;
        let renderLon = prop.telemetry.lon;
        let renderTrack = prop.groundTrack;
        let isLiveUtc = true;

        // If user activates "Overfly Selected Region", gently offset orbital ascending node cleanly over target
        if (propsRef.current.satOverflyTarget) {
          const lonShift = propsRef.current.selectedLon - prop.telemetry.lon;
          const latDiff = propsRef.current.selectedLat - prop.telemetry.lat;
          renderLat = Math.max(-80, Math.min(80, prop.telemetry.lat + latDiff * 0.85));
          renderLon = propsRef.current.selectedLon + Math.sin(nowMs * 0.00025) * 4.5;
          renderTrack = prop.groundTrack.map((pt) => ({
            lat: pt.lat,
            lon: pt.lon + lonShift,
            altKm: pt.altKm,
          }));
          isLiveUtc = false;
        }

        const orbitPts = buildRealOrbitVectors(renderTrack, EARTH_RADIUS);
        orbitLine.geometry.dispose();
        orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(orbitPts);

        const satR = EARTH_RADIUS * (1 + Math.max(0.11, (prop.telemetry.altitudeKm / 6371) * 1.65));
        const satPos = latLonToSceneVec3(renderLat, renderLon, satR);
        satHolder.position.copy(satPos);
        satHolder.lookAt(0, 0, 0);

        const surfUnder = satPos.clone().normalize().multiplyScalar(EARTH_RADIUS);
        nadirBeam.position.copy(satPos.clone().add(surfUnder).multiplyScalar(0.5));
        nadirBeam.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          satPos.clone().sub(surfUnder).normalize()
        );

        if (nowMs - lastTelemetryReportMs > 450 && propsRef.current.onTelemetryUpdate) {
          lastTelemetryReportMs = nowMs;
          propsRef.current.onTelemetryUpdate({
            ...prop.telemetry,
            lat: Number(renderLat.toFixed(2)),
            lon: Number(renderLon.toFixed(2)),
            isLiveUtc,
          });
        }
      }

      if (propsRef.current.filterMode === "wind") {
        updateWindBuffer(dtSec);
      }

      // Exponential High-Speed Orbital Dive Camera Animation
      if (propsRef.current.isDiving && diveRef.current.started) {
        diveRef.current.elapsed += dtSec;
        const tRaw = Math.min(1, diveRef.current.elapsed / diveRef.current.duration);
        const dirEase = 1 - Math.pow(1 - tRaw, 2.6);
        const distEase = Math.pow(tRaw, 2.15);

        const targetNadirDir = latLonToSceneVec3(
          propsRef.current.selectedLat,
          propsRef.current.selectedLon,
          1
        ).normalize();
        const startDir = diveRef.current.startPos.clone().normalize();
        const curDir = new THREE.Vector3().lerpVectors(startDir, targetNadirDir, dirEase).normalize();

        const startDist = diveRef.current.startPos.length();
        const endDist = EARTH_RADIUS * 1.028;
        const curDist = THREE.MathUtils.lerp(startDist, endDist, distEase);

        camera.position.copy(curDir.multiplyScalar(curDist));
        camera.fov = 42 + Math.sin(tRaw * Math.PI * 0.78) * 26;
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, 0);

        cloudMat.opacity = 0.24 + Math.sin(Math.min(1, tRaw * 1.25) * Math.PI) * 0.22;

        const approxAltKm = Math.round(Math.max(1, (curDist - EARTH_RADIUS) * 2100));
        propsRef.current.onDiveProgress?.(approxAltKm, tRaw);

        if (tRaw >= 1 && !diveRef.current.finished) {
          diveRef.current.finished = true;
          propsRef.current.onDiveComplete?.();
        }
      } else if (propsRef.current.cameraMode === "satellite") {
        // Unobstructed Satellite Optical Sensor Camera:
        // - "aperture" = Steady Target View (locks orbital sensor above selected region + smooth inertial gimbal pan)
        // - "exterior" = Live SGP4 Pass (rides real-time CGP4 orbital trajectory + smooth inertial gimbal pan)
        satHolder.visible = false;
        nadirBeam.visible = false;

        // Silky-smooth inertial damping for screen rotation (axıcı ekranı döndərmək)
        const gimbalDamp = 1 - Math.exp(-dtSec * 11.5);
        smoothLookRef.current.yaw += (satPovLookRef.current.yaw - smoothLookRef.current.yaw) * gimbalDamp;
        smoothLookRef.current.pitch += (satPovLookRef.current.pitch - smoothLookRef.current.pitch) * gimbalDamp;
        const { yaw, pitch } = smoothLookRef.current;

        const isSteadyTarget = propsRef.current.satPovStyle === "aperture";
        let worldCam: THREE.Vector3;
        let baseTarget: THREE.Vector3;

        if (isSteadyTarget) {
          // Steady orbital sensor vantage above selected region, angled across target toward curved purple horizon
          const selLat = propsRef.current.selectedLat;
          const selLon = propsRef.current.selectedLon;
          worldCam = latLonToSceneVec3(
            Math.max(-78, Math.min(78, selLat - 10.5)),
            selLon - 9.2,
            EARTH_RADIUS * 1.33
          );
          baseTarget = latLonToSceneVec3(
            Math.max(-82, Math.min(82, selLat + 2.2)),
            selLon + 2.0,
            EARTH_RADIUS * 1.0
          );
        } else {
          // Live SGP4 Pass vantage riding the instantaneous satellite orbital position
          worldCam = satHolder.position.clone().normalize().multiplyScalar(EARTH_RADIUS * 1.32);
          const upN = worldCam.clone().normalize();
          const tangent = new THREE.Vector3(-upN.z, 0.34, upN.x).normalize();
          baseTarget = worldCam.clone().addScaledVector(upN, -0.52).addScaledVector(tangent, 0.48);
        }

        const upVec = worldCam.clone().normalize();
        const baseDir = baseTarget.clone().sub(worldCam).normalize();
        const rightVec = new THREE.Vector3().crossVectors(baseDir, upVec).normalize();
        const orthoUp = new THREE.Vector3().crossVectors(rightVec, baseDir).normalize();

        const rotatedDir = baseDir
          .clone()
          .applyAxisAngle(upVec, -yaw * 0.85)
          .applyAxisAngle(rightVec, -pitch * 0.65)
          .normalize();
        const lookAtPoint = worldCam.clone().add(rotatedDir);

        camera.position.lerp(worldCam, 0.16);
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(camera.position, lookAtPoint, orthoUp)
        );
        camera.quaternion.slerp(targetQuat, 0.18);
        camera.fov += (45 - camera.fov) * 0.14;
        camera.updateProjectionMatrix();
      } else {
        satHolder.visible = true;
        nadirBeam.visible = true;
        const beaconObj = satHolder.getObjectByName("__sat_beacon__");
        if (beaconObj) {
          beaconObj.visible = true;
          beaconObj.lookAt(camera.position);
        }
        if (Math.abs(camera.fov - 42) > 0.05) {
          camera.fov += (42 - camera.fov) * 0.14;
          camera.updateProjectionMatrix();
        }
        controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.14);
        if (flyRef.current.active) {
          flyRef.current.progress = Math.min(1, flyRef.current.progress + dtSec * 1.65);
          const ease = 1 - Math.pow(1 - flyRef.current.progress, 3);
          const dir = new THREE.Vector3()
            .lerpVectors(
              flyRef.current.startPos.clone().normalize(),
              flyRef.current.endPos.clone().normalize(),
              ease
            )
            .normalize();
          const d = THREE.MathUtils.lerp(
            flyRef.current.startPos.length(),
            flyRef.current.endPos.length(),
            ease
          );
          camera.position.copy(dir.multiplyScalar(d));
          if (flyRef.current.progress >= 1) flyRef.current.active = false;
        }
        controls.update();
      }

      projectHtmlReticles();
      renderer.render(scene, camera);
    };

    // Pre-seed wind vertex buffers immediately so Wind mode never renders origin-zero spikes on first frame
    updateWindBuffer(0.016);
    animId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      controls.dispose();
      satHitGeo.dispose();
      satHitMat.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      orbitLine.geometry.dispose();
      orbitMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      windGeo.dispose();
      windMat.dispose();
      stars.geometry.dispose();
      constellationNet.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="sf-globe-canvas-wrap" ref={hostRef}>
      {/* Aerospace projected HTML reticle overlay (no blocky 3D pins or arrows) */}
      <div className="sf-reticle-layer" aria-hidden={isDiving}>
        {ORBITAL_PRESETS.map((preset) => {
          const isActive = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              ref={(el) => {
                if (el) reticleRefs.current.set(preset.id, el);
                else reticleRefs.current.delete(preset.id);
              }}
              className={`sf-reticle-pin ${isActive ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectLocation(
                  preset.lat,
                  preset.lon,
                  preset.id,
                  language === "az" ? preset.nameAz : preset.nameEn
                );
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onRequestDive?.(
                  preset.lat,
                  preset.lon,
                  preset.id,
                  language === "az" ? preset.nameAz : preset.nameEn
                );
              }}
              title={`${preset.lat.toFixed(2)}°N, ${preset.lon.toFixed(2)}°E`}
            >
              <span className="sf-reticle-brackets" aria-hidden="true" />
              <span className="sf-reticle-tag">
                {(language === "az" ? preset.nameAz : preset.nameEn).split(/[\s—/-]+/)[0]}
              </span>
            </button>
          );
        })}

        {/* Floating Satellite Beacon Hover / Double-Click Lock Reticle in Orbit Mode */}
        <div
          ref={satHintRef}
          className={`sf-sat-hover-hint ${satHovered ? "is-hovered" : ""}`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onEnterSatellitePov?.();
          }}
        >
          <span className="sf-sat-dot" />
          <span>
            {satelliteTle.id.toUpperCase()} •{" "}
            {language === "az" ? "2× klik: Peyk Kamerası" : "Double-click: Sensor POV"}
          </span>
        </div>

        {/* Active Selected Coordinate Crosshair */}
        <div
          ref={selectedReticleRef}
          className="sf-selected-crosshair"
          aria-hidden="true"
        >
          <span className="sf-crosshair-pulse" />
        </div>
      </div>

      {/* Subtle Asset & Resolution Status Chips (hidden during cockpit HUD) */}
      {cameraMode === "orbit" && !isDiving && (
        <div className="sf-engine-chips">
          <span className={`sf-engine-chip ${hdReady ? "is-live" : ""}`}>
            {regionHdReady ? "NASA 5K + 500M HD" : hdReady ? "NASA 5K GIBS" : "NASA 2K→5K…"}
          </span>
          <span className="sf-engine-chip is-live">
            {`${satelliteTle.id.toUpperCase()} SGP4 BEACON`}
          </span>
          {filterMode === "thermal" && (
            <span className={`sf-engine-chip ${thermalReady ? "is-live" : ""}`}>
              {thermalReady ? "MODIS LST + OPEN-METEO" : "MODIS…"}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
