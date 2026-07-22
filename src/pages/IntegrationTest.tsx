// @ts-nocheck - dev-only integration test page
import { useState, useCallback, useEffect, useRef } from "react";

// Import GLSL shaders as raw strings (Vite ?raw)
import forwardVert from "../webgl3d/shaders/common/forward.vert?raw";
import forwardFrag from "../webgl3d/shaders/common/forward.frag?raw";

interface TestItem {
  name: string;
  status: "pending" | "running" | "pass" | "fail";
  detail: string;
}

export default function IntegrationTest() {
  const [tests, setTests] = useState<TestItem[]>([
    { name: "1. 模块初始化 (init)", status: "pending", detail: "" },
    { name: "2. Shader 编译 (PBR forward)", status: "pending", detail: "" },
    { name: "3. SceneManager 场景注册+切换", status: "pending", detail: "" },
    { name: "4. ResourceCache 资源注册/释放", status: "pending", detail: "" },
    { name: "5. CircuitBreaker CLOSED→OPEN", status: "pending", detail: "" },
    { name: "6. MetricsCollector 指标采集", status: "pending", detail: "" },
    { name: "7. 渲染循环 60 帧", status: "pending", detail: "" },
    { name: "8. 模块销毁 (destroy) 清理", status: "pending", detail: "" },
  ]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const update = useCallback((i: number, patch: Partial<TestItem>) => {
    setTests(t => t.map((x, j) => j === i ? { ...x, ...patch } : x));
  }, []);

  const run = useCallback(async () => {
    setRunning(true); setDone(false);
    setTests(t => t.map(x => ({ ...x, status: "pending" as const, detail: "" })));

    try {
      // ── Test 1: Init ───────────────────────────────────────────────
      update(0, { status: "running" });
      const mod = await import("@/webgl3d");
      const container = containerRef.current!;
      const ok = await mod.init(container, true);
      if (!ok) { update(0, { status: "fail", detail: "init() 返回 false" }); return; }
      const checks = [
        mod.getRenderer(), mod.getCircuitBreaker(), mod.getResourceCache(),
        mod.getShaderCompiler(), mod.getMetrics(), mod.getSceneManager(),
        mod.getPostProcess(), mod.getRayPicker(), mod.getEventBus(),
        mod.getInteractionResolver(),
      ];
      const allOk = checks.every(c => c !== null);
      update(0, { status: allOk ? "pass" : "fail", detail: allOk ? `11/11 模块就绪` : `${checks.filter(c=>c).length}/11 模块就绪` });

      // ── Test 2: Shader compile ─────────────────────────────────────
      update(1, { status: "running" });
      const sc = mod.getShaderCompiler()!;
      const gl = mod.getRenderer()!.getContext()!;
      const prog = sc.compile(forwardVert, forwardFrag, "integration_test");
      const ok2 = gl.isProgram(prog) && gl.getProgramParameter(prog, gl.LINK_STATUS);
      update(1, { status: ok2 ? "pass" : "fail", detail: ok2 ? "PBR forward.frag 编译+链接成功" : "program link 失败" });
      gl.deleteProgram(prog); // cleanup

      // ── Test 3: SceneManager ──────────────────────────────────────
      update(2, { status: "running" });
      const sm = mod.getSceneManager()!;
      sm.registerScene({
        id: "test_scene", nameKey: "test", descriptionKey: "test",
        modelRef: "models/test.glb",
        defaultCamera: { position: [0,1.5,5], target: [0,1,0], fov: 60, nearPlane: 0.1, farPlane: 100, minDistance: 1, maxDistance: 10, minPolarAngle: 0.1, maxPolarAngle: 1.5 },
        lights: [{ id: "l1", type: "ambient", color: [1,1,1], intensity: 0.5 }],
        nodes: [],
      });
      const diff = await sm.switchScene("test_scene");
      const ok3 = sm.getCurrentSceneId() === "test_scene" && sm.getLights().length === 1;
      update(2, { status: ok3 ? "pass" : "fail", detail: ok3 ? `场景切换成功 (unload:${diff.unload.length}, load:${diff.load.length})` : `current=${sm.getCurrentSceneId()}` });

      // ── Test 4: ResourceCache ─────────────────────────────────────
      update(3, { status: "running" });
      const rc = mod.getResourceCache()!;
      const testTex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, testTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,0,0,255]));
      rc.register("test_tex", "texture", () => gl.deleteTexture(testTex));
      const countAfterReg = rc.count();
      rc.touch("test_tex");
      rc.unregister("test_tex");
      const countAfterUnreg = rc.count();
      const ok4 = countAfterReg === 1 && countAfterUnreg === 0;
      update(3, { status: ok4 ? "pass" : "fail", detail: ok4 ? "注册→touch→释放，计数 1→0" : `reg=${countAfterReg} unreg=${countAfterUnreg}` });

      // ── Test 5: CircuitBreaker ────────────────────────────────────
      update(4, { status: "running" });
      const cb = mod.getCircuitBreaker()!;
      cb.reset();
      const s0 = cb.getState();
      cb.recordError(); cb.recordError();
      const s1 = cb.getState(); // should still be CLOSED (2 < 3)
      cb.recordError();
      const s2 = cb.getState(); // should be OPEN (3 reached)
      const ok5 = s0 === "CLOSED" && s1 === "CLOSED" && s2 === "OPEN";
      update(4, { status: ok5 ? "pass" : "fail", detail: ok5 ? `CLOSED→CLOSED(2err)→OPEN(3err)` : `${s0}→${s1}→${s2}` });
      cb.reset();

      // ── Test 6: MetricsCollector ───────────────────────────────────
      update(5, { status: "running" });
      const mc = mod.getMetrics()!;
      mc.start();
      await new Promise(r => setTimeout(r, 1100)); // wait for 1 sample
      const snap = mc.getSnapshot();
      mc.stop();
      const ok6 = snap.fps >= 0 && snap.frameTimeMs >= 0;
      update(5, { status: ok6 ? "pass" : "fail", detail: ok6 ? `FPS=${snap.fps}, Heap=${snap.jsHeapMB}MB` : `snapshot invalid` });

      // ── Test 7: Render loop ────────────────────────────────────────
      update(6, { status: "running" });
      const rm = mod.getRenderer()!;
      let frameCount = 0;
      rm.setCallbacks({
        onFrame() { frameCount++; },
        onFpsUpdate() {},
      });
      mc.start();
      rm.startLoop();
      await new Promise(r => setTimeout(r, 1100));
      rm.stopLoop();
      mc.stop();
      const ok7 = frameCount > 30; // at least 30 frames in 1s (should be 60)
      update(6, { status: ok7 ? "pass" : "fail", detail: ok7 ? `${frameCount} 帧/1.1s (≈${Math.round(frameCount/1.1)} FPS)` : `仅 ${frameCount} 帧` });

      // ── Test 8: Destroy ────────────────────────────────────────────
      update(7, { status: "running" });
      await mod.destroy();
      const checks2 = [
        mod.getRenderer(), mod.getCircuitBreaker(), mod.getResourceCache(),
        mod.getShaderCompiler(), mod.getMetrics(), mod.getSceneManager(),
        mod.getPostProcess(), mod.getRayPicker(), mod.getEventBus(),
        mod.getInteractionResolver(),
      ];
      const allNull = checks2.every(c => c === null);
      update(7, { status: allNull ? "pass" : "fail", detail: allNull ? "全部模块返回 null" : `${checks2.filter(c=>c).length} 个未清理` });

    } catch (e) {
      for (let i = 0; i < 8; i++) {
        setTests(t => t.map((x, j) => x.status === "running" ? { ...x, status: "fail", detail: String(e) } : x));
      }
    }
    setDone(true); setRunning(false);
  }, []);

  const passCount = tests.filter(t => t.status === "pass").length;
  const failCount = tests.filter(t => t.status === "fail").length;

  return (
    <div className="h-full bg-[#0a0a14] text-white overflow-auto p-6">
      {/* Hidden container for 3D canvas */}
      <div ref={containerRef} className="absolute" style={{ width: 1, height: 1, overflow: "hidden" }} />

      <div className="max-w-[600px] mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">阶段 1 集成验证</h1>
            <p className="text-xs text-gray-500 mt-1">动态 import → init → 逐模块验证 → destroy</p>
          </div>
          <a href="/" className="text-xs text-gray-500 hover:text-cyan-400 transition underline">← 返回首页</a>
        </div>

        {/* Results table */}
        <div className="bg-black/60 rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-gray-400 border-b border-white/10 bg-white/5"><th className="text-left py-2 px-4">测试项</th><th className="text-right py-2 px-4 w-16">结果</th><th className="text-left py-2 px-4 text-xs">详情</th></tr></thead>
            <tbody>{tests.map((t, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                <td className="py-2 px-4">{t.name}</td>
                <td className={`py-2 px-4 text-right font-mono text-xs ${t.status === "pass" ? "text-green-400" : t.status === "fail" ? "text-red-400" : t.status === "running" ? "text-yellow-400 animate-pulse" : "text-gray-600"}`}>{t.status === "pending" ? "—" : t.status.toUpperCase()}</td>
                <td className="py-2 px-4 text-xs text-gray-500">{t.detail}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* Summary */}
        {done && (
          <div className={`p-3 rounded-lg border text-sm ${failCount === 0 ? "bg-green-900/30 border-green-700 text-green-300" : "bg-red-900/30 border-red-700 text-red-300"}`}>
            {passCount}/8 通过{failCount > 0 && `，${failCount} 失败`}
          </div>
        )}

        {!running && !done && <button onClick={run} className="bg-cyan-600 hover:bg-cyan-500 transition px-6 py-2.5 rounded-lg text-sm font-medium">运行集成验证</button>}
        {running && <p className="text-yellow-400 text-sm animate-pulse">运行中...</p>}
        {done && <button onClick={run} className="bg-cyan-600/50 hover:bg-cyan-500/70 transition px-6 py-2.5 rounded-lg text-sm font-medium">重新运行</button>}

        <p className="text-[11px] text-gray-600 leading-relaxed mt-4">开发环境独有。动态 import 方式加载 3D 模块，验证 init/destroy 生命周期和所有渲染内核模块的接口契约。</p>
      </div>
    </div>
  );
}
