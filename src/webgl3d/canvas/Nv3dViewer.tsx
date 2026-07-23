/**
 * Nv3dViewer — drag .nv3d → parse → render in a proper cyberpunk room.
 *
 * The room (walls/floor/ceiling) is built in Three.js with PBR textures
 * from the NV3D's textures/ category. Props are loaded via GLTFLoader
 * with pre-rewritten URIs and placed at fixed positions inside the room.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getNv3dLoader } from "../loader/Nv3dLoader";

const ROOM = { w: 10, h: 3.5, d: 8 };

export default function Nv3dViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rafRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("点击选择 .nv3d 文件或拖入");
  const [fps, setFps] = useState(0);
  const [meta, setMeta] = useState("");
  const fpsCount = useRef({ frames: 0, lastTime: performance.now() });

  const loop = useCallback(() => {
    const renderer = rendererRef.current, scene = sceneRef.current;
    if (!renderer || !scene) return;
    const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 100);
    camera.position.set(0, 2, 6); camera.lookAt(0, 1.2, -2);
    const ctrl = new OrbitControls(camera, renderer.domElement);
    ctrl.target.set(0, 1.2, -2); ctrl.enableDamping = true; ctrl.maxPolarAngle = Math.PI * 0.7;
    controlsRef.current = ctrl;
    const loopFn = (now: number) => {
      ctrl.update(); renderer.render(scene, camera);
      fpsCount.current.frames++;
      if (now - fpsCount.current.lastTime >= 1000) {
        setFps(fpsCount.current.frames);
        fpsCount.current.frames = 0;
        fpsCount.current.lastTime = now;
      }
      rafRef.current = requestAnimationFrame(loopFn);
    };
    rafRef.current = requestAnimationFrame(loopFn);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040210);
    sceneRef.current = scene;

    window.addEventListener("resize", () => {
      const w = canvas.clientWidth; const h = canvas.clientHeight;
      if (w && h) renderer.setSize(w, h, false);
    });
    loop();
    return () => { cancelAnimationFrame(rafRef.current); renderer.dispose(); controlsRef.current?.dispose(); };
  }, []);

  // ── Build room with PBR textures from NV3D ─────────────────
  function buildRoom(blobMap: Map<string, string>) {
    const tex = (name: string) => {
      // find by filename in blobMap values (which are blob: URLs)
      for (const [id, url] of blobMap) {
        if (id.endsWith(name) || id.includes(name))
          return new THREE.TextureLoader().load(url);
      }
      return null;
    };

    const floorTex = tex("floor_color");
    const floorNrm = tex("floor_normal");
    const wallTex  = tex("wall_color");
    const wallNrm  = tex("wall_normal");
    const wallMR   = tex("wall_roughness");
    const wallAO   = tex("wall_ao");
    const ceilTex  = tex("ceiling_color");
    const ceilNrm  = tex("ceiling_normal");

    const group = new THREE.Group();
    group.name = "cyber_room";

    const { w, h, d } = ROOM;
    const halfW = w / 2; const halfD = d / 2;

    const texOpt = (tex: THREE.Texture | null) => {
      if (!tex) return {};
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2);
      tex.colorSpace = THREE.SRGBColorSpace;
      return { map: tex };
    };
    const nrmOpt = (tex: THREE.Texture | null) => {
      if (!tex) return {};
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2);
      return { normalMap: tex, normalScale: new THREE.Vector2(0.5, 0.5) };
    };

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        ...texOpt(floorTex), ...nrmOpt(floorNrm), roughness: 0.9, metalness: 0.05, color: 0xeeeeee
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.name = "floor";
    group.add(floor);

    // Ceiling
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        ...texOpt(ceilTex), ...nrmOpt(ceilNrm), roughness: 0.4, metalness: 0.9, color: 0xcccccc
      })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = h;
    ceil.name = "ceiling";
    group.add(ceil);

    // Back wall
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        ...texOpt(wallTex), ...nrmOpt(wallNrm),
        roughnessMap: wallMR, roughness: 0.5, metalness: 0.8,
        aoMap: wallAO, color: 0xcccccc
      })
    );
    back.position.set(0, h / 2, -halfD);
    back.name = "back_wall";
    group.add(back);

    // Left wall
    const left = new THREE.Mesh(
      new THREE.PlaneGeometry(d, h),
      new THREE.MeshStandardMaterial({
        ...texOpt(wallTex), ...nrmOpt(wallNrm),
        roughnessMap: wallMR, roughness: 0.5, metalness: 0.8,
        aoMap: wallAO, color: 0xcccccc
      })
    );
    left.rotation.y = Math.PI / 2;
    left.position.set(-halfW, h / 2, 0);
    left.name = "left_wall";
    group.add(left);

    // Right wall
    const right = new THREE.Mesh(
      new THREE.PlaneGeometry(d, h),
      new THREE.MeshStandardMaterial({
        ...texOpt(wallTex), ...nrmOpt(wallNrm),
        roughnessMap: wallMR, roughness: 0.5, metalness: 0.8,
        aoMap: wallAO, color: 0xcccccc
      })
    );
    right.rotation.y = -Math.PI / 2;
    right.position.set(halfW, h / 2, 0);
    right.name = "right_wall";
    group.add(right);

    return group;
  }

  // ── Light the room ─────────────────────────────────────────
  function lightRoom(scene: THREE.Scene) {
    scene.add(new THREE.AmbientLight(0x110a22, 0.5));

    const pink = new THREE.PointLight(0xff1188, 15, 12, 1);
    pink.position.set(0, 2.8, -ROOM.d / 2 + 0.2);
    pink.castShadow = false;
    scene.add(pink);

    const cyan = new THREE.PointLight(0x22aaff, 10, 10, 1);
    cyan.position.set(ROOM.w / 2 - 1, 1.5, -2);
    scene.add(cyan);

    const purple = new THREE.PointLight(0x8822ff, 8, 8, 1);
    purple.position.set(-ROOM.w / 2 + 1, 2, 0);
    scene.add(purple);

    const warm = new THREE.DirectionalLight(0xffcc88, 1.5);
    warm.position.set(0, 5, 5);
    scene.add(warm);
  }

  // ── Load a model and fit it ─────────────────────────────────
  // wallSide: "back" (z=-4), "left" (x=-5), "right" (x=+5)
  async function loadAndPlace(
    loader: GLTFLoader, url: string,
    wallSide: "back" | "left" | "right",
    along: number, yOff: number, targetH: number,
    label: string
  ): Promise<THREE.Object3D | null> {
    try {
      const g = await loader.loadAsync(url);
      const root = g.scene;
      root.updateWorldMatrix(true, false);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const { w, h, d } = ROOM;
      const halfW = w / 2; const halfD = d / 2;

      if (maxDim > 0.005 && maxDim < 5000) {
        const s = targetH / maxDim;
        const nativeDepth = Math.max(size.x, size.z); // model's thickest horizontal dim
        const scaledDepth = nativeDepth * s;

        root.scale.setScalar(s);

        if (wallSide === "back") {
          // Wall at z=-halfD. Model faces +Z (rotY=0). Back of model flush to wall.
          root.position.set(along, yOff - box.min.y * s, -halfD + scaledDepth / 2);
          root.rotation.set(0, 0, 0);
        } else if (wallSide === "left") {
          // Wall at x=-halfW. Model faces +X (rotY=-PI/2). Back flush to wall.
          root.position.set(-halfW + scaledDepth / 2, yOff - box.min.y * s, along);
          root.rotation.set(0, -Math.PI / 2, 0);
        } else {
          // right wall at x=+halfW. Model faces -X (rotY=+PI/2). Back flush to wall.
          root.position.set(halfW - scaledDepth / 2, yOff - box.min.y * s, along);
          root.rotation.set(0, Math.PI / 2, 0);
        }
        console.log(`[${label}] ${wallSide} wall · raw ${maxDim.toFixed(1)}m ×${s.toFixed(3)} · depth ${scaledDepth.toFixed(2)}m · pos ${root.position.toArray().map(v=>v.toFixed(2))} · size ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)}`);
      }
      root.name = label;
      return root;
    } catch (e) {
      console.error(`[Viewer] ${label} failed:`, e);
      return null;
    }
  }

  // ── Drop handler ──────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setStatus("解析中...");
    try {
      const buf = await file.arrayBuffer();
      const ld = getNv3dLoader();
      const loaded = await ld.load(buf);
      const { blobMap, blocks } = loaded;

      const scene = sceneRef.current;
      if (!scene) return;

      // ── Detect: monolithic scene.glb vs multi-prop room ──────────
      const sceneBlock = blocks.find(b => b.id === "scene" || b.path?.endsWith("scene.glb"));
      const isMonolithic = sceneBlock && blocks.length <= 3; // 1 model + 0-2 misc resources

      // Clear
      while (scene.children.length > 0) scene.remove(scene.children[0]);

      if (isMonolithic && sceneBlock) {
        // ── Monolithic: load scene.glb directly ──────────────────
        setStatus("加载完整场景...");
        const url = blobMap.get(sceneBlock.id);
        if (!url) throw new Error("scene block has no blob URL");
        const gl = new GLTFLoader();
        const g = await gl.loadAsync(url);
        scene.add(g.scene);

        // Add lights — GLB may not have its own (KHR_lights_punctual is optional)
        const sun = new THREE.DirectionalLight(0xffffff, 2);
        sun.position.set(5, 10, 5);
        scene.add(sun);
        const amb = new THREE.AmbientLight(0x333344, 1.5);
        scene.add(amb);

        const box = new THREE.Box3().setFromObject(g.scene);
        const sz = box.getSize(new THREE.Vector3());
        const ct = box.getCenter(new THREE.Vector3());
        if (controlsRef.current) {
          controlsRef.current.target.copy(ct);
        }
        setStatus(`✅ ${blocks.length} 资源 · ${(sceneBlock.data.byteLength / (1024*1024)).toFixed(0)}MB`);
        setMeta(`场景: ${(sz.x).toFixed(1)}×${(sz.y).toFixed(1)}×${(sz.z).toFixed(1)}m · ${g.scene.children.length} nodes`);
      } else {
        // ── Multi-prop room layout ───────────────────────────────
        lightRoom(scene);
        const room = buildRoom(blobMap);
        scene.add(room);
        const grid = new THREE.GridHelper(12, 12, 0xff1188, 0x332244);
        grid.position.y = 0.001;
        scene.add(grid);
        setStatus("✅ 房间已就绪");

        const gltfLoader = new GLTFLoader();
        const dirUrls = new Map<string, string>();
        for (const b of blocks) {
          if (b.ext === ".gltf" || b.ext === ".glb") {
            const dir = b.path.includes("/") ? b.path.split("/")[1] : b.id;
            if (!dirUrls.has(dir)) dirUrls.set(dir, blobMap.get(b.id)!);
          }
        }

        let ok = 0, fail = 0;
        const layout: Array<[string, string, "back"|"left"|"right", number, number, number]> = [
          ["🎆霓虹招牌", "neon_sign", "back", 0, 2.4, 2.0],
          ["街机", "arcade", "back", -2.8, 0, 2.0],
          ["售货机", "vendingmachine", "back", 3.5, 0, 2.0],
          ["ATM", "atm", "left", -2, 0, 2.0],
          ["金属桌", "desk", "left", -3, 0, 1.0],
          ["电竞桌+椅", "gaming_setup", "right", -2.5, 0, 1.4],
        ];

        for (const [label, dirKey, wallSide, along, yOff, th] of layout) {
          const url = dirUrls.get(dirKey);
          if (!url) { fail++; continue; }
          const obj = await loadAndPlace(gltfLoader, url, wallSide, along, yOff, th, label);
          if (obj) { scene.add(obj); ok++; } else fail++;
          setStatus(`✅ ${ok}/${ok + fail} | ${label}`);
        }
        setStatus(`✅ ${ok}/${ok + fail} 模型 + 房间已渲染`);
        setMeta("10×3.5×8m 房间 · 6 道具 · 金属墙/混凝土地板/暗金天花板");
      }

    } catch (e) {
      setStatus(`❌ ${String(e)}`);
      console.error(e);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name?.endsWith(".nv3d")) handleFile(file);
  }, [handleFile]);
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  const onFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const showingEmpty = status.includes("点击") || status.includes("拖入");

  return (
    <div className="fixed inset-0 bg-black" style={{ zIndex: 0 }} onDrop={onDrop} onDragOver={onDragOver}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <input ref={fileInputRef} type="file" accept=".nv3d" style={{ display: "none" }} onChange={onFilePick} />
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-10">
        <button onClick={() => fileInputRef.current?.click()} className="bg-black/75 backdrop-blur-md rounded-xl px-6 py-3 text-center border border-white/10 hover:border-purple-500/30 transition-colors cursor-pointer">
          <div className="text-white text-sm font-medium">{status}</div>
          {meta && <div className="text-white/50 text-[11px] mt-1">{meta}</div>}
          {fps > 0 && <div className="text-lime-400 text-xs mt-1 font-mono tabular-nums">{fps} FPS</div>}
        </button>
      </div>
      {showingEmpty && (
        <div className="fixed inset-0 flex items-center justify-center z-20">
          <button onClick={() => fileInputRef.current?.click()} className="text-white/50 hover:text-purple-400 transition-colors text-lg font-light tracking-wider cursor-pointer bg-white/5 hover:bg-white/10 rounded-2xl px-8 py-6 border border-white/10 hover:border-purple-500/30">
            点击选择 .nv3d 文件<br/>
            <span className="text-xs text-white/30 mt-1 block">或拖入文件到此窗口</span>
          </button>
        </div>
      )}
    </div>
  );
}
