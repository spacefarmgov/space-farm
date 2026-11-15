import type { EarthDrawState, EarthEngineHandle } from "./earthWebgl";

export type { EarthDrawState, EarthEngineHandle };

/**
 * Mounts an interactive 3D Earth into `container`, preferring WebGL2/WebGL
 * Three.js rendering and falling back transparently to a spherical 2D canvas
 * projection when WebGL is unavailable.
 */
export async function mountEarth(container: HTMLElement): Promise<EarthEngineHandle> {
  const probe = document.createElement("canvas");
  let context: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    context = (probe.getContext("webgl2", { alpha: true, antialias: true }) ||
      probe.getContext("webgl", { alpha: true, antialias: true })) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
  } catch {
    context = null;
  }

  if (context) {
    try {
      const { mountWebGL } = await import("./earthWebgl");
      return await mountWebGL(container, probe, context);
    } catch (err) {
      console.warn("Using compatible Earth canvas renderer", err);
      probe.remove();
    }
  } else {
    probe.remove();
  }

  return mountCanvas(container);
}

async function loadPixels(path: string): Promise<ImageData> {
  const image = new Image();
  image.src = path;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error(`Unable to obtain 2D context for ${path}`);
  }
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function mountCanvas(container: HTMLElement): Promise<EarthEngineHandle> {
  const [land, cloud] = await Promise.all([
    loadPixels("/earth-3d/assets/ColorMap.jpg"),
    loadPixels("/earth-3d/assets/alphaMap.jpg"),
  ]);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to initialize 2D Earth canvas");
  }
  container.append(canvas);

  const off = document.createElement("canvas");
  const size = 560;
  off.width = off.height = size;
  const oc = off.getContext("2d");
  if (!oc) {
    throw new Error("Unable to initialize offscreen Earth canvas");
  }
  const buffer = oc.createImageData(size, size);
  const normals = new Float32Array(size * size * 3);
  const lights = new Float32Array(size * size);
  const edge = new Float32Array(size * size);
  let w = 1;
  let h = 1;
  let dpr = 1;
  let lastState: EarthDrawState | null = null;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const j = i * 3;
      const nx = (x - size / 2) / (size / 2);
      const ny = (size / 2 - y) / (size / 2);
      const d = nx * nx + ny * ny;
      normals[j] = nx;
      normals[j + 1] = ny;
      normals[j + 2] = d < 1 ? Math.sqrt(1 - d) : -1;
      if (d < 1) {
        const z = normals[j + 2];
        lights[i] = 0.14 + 0.96 * Math.max(0, -0.62 * nx + 0.24 * ny + 0.65 * z);
        edge[i] = Math.pow(1 - z, 3.8) * 0.72;
        buffer.data[i * 4 + 3] = Math.min(255, (1 - Math.sqrt(d)) * size * 128);
      }
    }
  }

  function resize() {
    w = Math.max(1, container.clientWidth);
    h = Math.max(1, container.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (lastState) draw(lastState);
  }

  function draw(s: EarthDrawState) {
    lastState = s;
    const a = (s.latitude * Math.PI) / 180;
    const co = Math.cos(a);
    const si = Math.sin(a);
    const longitude = s.longitude / 360;

    for (let i = 0; i < size * size; i += 1) {
      const j = i * 3;
      const z = normals[j + 2];
      if (z < 0) continue;
      const x = normals[j];
      const y = normals[j + 1];
      const lat = Math.asin(y * co + z * si);
      const u = (((longitude + Math.atan2(x, z * co - y * si) / (Math.PI * 2) + 0.5) % 1) + 1) % 1;
      const v = 0.5 - lat / Math.PI;
      const pos =
        (Math.min(land.height - 1, Math.floor(v * land.height)) * land.width +
          Math.floor(u * land.width)) *
        4;
      const cu = (((u + s.cloudOffset / 360) % 1) + 1) % 1;
      const cp =
        (Math.min(cloud.height - 1, Math.floor(v * cloud.height)) * cloud.width +
          Math.floor(cu * cloud.width)) *
        4;
      const alpha = s.clouds ? Math.pow(cloud.data[cp + 1] / 255, 1.1) * 0.89 : 0;
      const l = lights[i];
      const r = edge[i];
      const b = i * 4;
      buffer.data[b] = (land.data[pos] * (1 - alpha) + 245 * alpha) * l + r * 92;
      buffer.data[b + 1] = (land.data[pos + 1] * (1 - alpha) + 250 * alpha) * l + r * 116;
      buffer.data[b + 2] = (land.data[pos + 2] * (1 - alpha) + 255 * alpha) * l + r * 246;
    }

    oc!.putImageData(buffer, 0, 0);
    ctx!.clearRect(0, 0, w, h);

    const r = Math.min(w * 0.42, h * 0.42) * s.zoom;
    const cx = w < 650 ? w * 0.5 : w * 0.52;
    const cy = h * 0.49;

    const glow = ctx!.createRadialGradient(cx, cy, r * 0.94, cx, cy, r * 1.15);
    glow.addColorStop(0, "rgba(104, 128, 255, 0.30)");
    glow.addColorStop(0.5, "rgba(56, 189, 248, 0.16)");
    glow.addColorStop(1, "rgba(18, 20, 48, 0)");
    ctx!.fillStyle = glow;
    ctx!.beginPath();
    ctx!.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.drawImage(off, cx - r, cy - r, r * 2, r * 2);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  return {
    software: true,
    draw,
    dispose() {
      observer.disconnect();
      canvas.remove();
    },
  };
}
