import * as THREE from "three";

export interface EarthDrawState {
  latitude: number;
  longitude: number;
  zoom: number;
  rotate: boolean;
  clouds: boolean;
  cloudOffset: number;
}

export interface EarthEngineHandle {
  software: boolean;
  draw: (state: EarthDrawState) => void;
  dispose: () => void;
}

/**
 * Hardware-accelerated Three.js Earth renderer with ColorMap, Bump relief,
 * Ocean Specular mask, drifting cloud sphere, and BackSide atmospheric shader.
 */
export async function mountWebGL(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  context: WebGLRenderingContext | WebGL2RenderingContext,
): Promise<EarthEngineHandle> {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const group = new THREE.Group();
  scene.add(group);

  const loader = new THREE.TextureLoader();
  let textures: THREE.Texture[];
  try {
    textures = await Promise.all(
      ["ColorMap.jpg", "Bump.jpg", "SpecMask.jpg", "alphaMap.jpg"].map((name) =>
        loader.loadAsync(`/earth-3d/assets/${name}`),
      ),
    );
  } catch (err) {
    renderer.dispose();
    throw err;
  }

  const [map, bump, spec, alpha] = textures;
  map.colorSpace = THREE.SRGBColorSpace;
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  for (const tex of textures) {
    tex.anisotropy = maxAniso;
  }

  const geo = new THREE.SphereGeometry(1, 96, 64);
  const material = new THREE.MeshPhongMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.008,
    specularMap: spec,
    shininess: 8,
    specular: 0x637186,
  });
  const earth = new THREE.Mesh(geo, material);
  group.add(earth);

  const cloudMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    alphaMap: alpha,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const clouds = new THREE.Mesh(geo, cloudMaterial);
  clouds.scale.setScalar(1.006);
  group.add(clouds);

  scene.add(new THREE.AmbientLight(0x8c8eff, 0.52));
  const sunLight = new THREE.DirectionalLight(0xfff5e4, 2.5);
  sunLight.position.set(-4, 1.4, 4);
  scene.add(sunLight);

  const glowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader:
      "varying vec3 n;varying vec3 p;void main(){n=normalize(normalMatrix*normal);vec4 v=modelViewMatrix*vec4(position,1.0);p=v.xyz;gl_Position=projectionMatrix*v;}",
    fragmentShader:
      "varying vec3 n;varying vec3 p;void main(){float k=pow(max(0.0,1.0-abs(dot(normalize(n),normalize(-p)))),3.8);gl_FragColor=vec4(0.32,0.52,1.0,k*0.72);}",
  });
  const atmosphere = new THREE.Mesh(geo, glowMaterial);
  atmosphere.scale.setScalar(1.04);
  scene.add(atmosphere);

  let state: EarthDrawState | null = null;
  let w = 1;
  let h = 1;

  function resize() {
    w = Math.max(1, container.clientWidth);
    h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (state) draw(state);
  }

  function draw(nextState: EarthDrawState) {
    state = nextState;
    group.rotation.set(
      (nextState.latitude * Math.PI) / 180,
      ((-90 - nextState.longitude) * Math.PI) / 180,
      0,
    );
    clouds.rotation.y = (-nextState.cloudOffset * Math.PI) / 180;
    clouds.visible = nextState.clouds;

    const targetRadius = Math.min(w * 0.42, h * 0.42) * nextState.zoom;
    camera.position.z = h / (2 * targetRadius * Math.tan((21 * Math.PI) / 180));
    const offset = w < 650 ? 0 : w * 0.02;
    camera.setViewOffset(w, h, -offset, 0, w, h);
    renderer.render(scene, camera);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  return {
    software: false,
    draw,
    dispose() {
      observer.disconnect();
      textures.forEach((t) => t.dispose());
      geo.dispose();
      material.dispose();
      cloudMaterial.dispose();
      glowMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
