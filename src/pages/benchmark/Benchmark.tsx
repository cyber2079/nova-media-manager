// @ts-nocheck - dev-only benchmark, TS closure narrowing isn't worth the noise
import { useEffect, useRef, useState, useCallback } from "react";
import { mat4, vec3 } from "gl-matrix";

// ─── Types ────────────────────────────────────────────────────────────────

interface Metrics {
  fps: number; frameTimeMs: number; jsHeapMB: number;
  drawCalls: number; triangleCount: number; textureCount: number; contextCreateMs: number;
}

interface TestResult { name: string; status: "pending" | "running" | "pass" | "fail"; value: string; threshold: string; }

// ─── GLSL ──────────────────────────────────────────────────────────────────

const VS = `#version 300 es
layout(location=0) in vec3 a_pos; layout(location=1) in vec3 a_norm; layout(location=2) in vec2 a_uv;
uniform mat4 u_mvp;
out vec3 v_n; out vec2 v_uv;
void main(){v_n=a_norm;v_uv=a_uv;gl_Position=u_mvp*vec4(a_pos,1.0);}`;

const FS = `#version 300 es
precision highp float;
in vec3 v_n;in vec2 v_uv;
uniform vec3 u_l;uniform sampler2D u_t;
out vec4 f;
void main(){float d=max(dot(normalize(v_n),normalize(u_l)),0.1);vec3 c=texture(u_t,v_uv*3.0).rgb;f=vec4(c*d,1.0);}`;

// ─── Geometry ──────────────────────────────────────────────────────────────

function torus(rings: number, segs: number, R: number, r: number) {
  const v: number[]=[],n: number[]=[],u: number[]=[],idx: number[]=[];
  for(let i=0;i<=rings;i++){const phi=i/rings*Math.PI*2;
    for(let j=0;j<=segs;j++){const th=j/segs*Math.PI*2,cx=(R+r*Math.cos(th))*Math.cos(phi),cy=r*Math.sin(th),cz=(R+r*Math.cos(th))*Math.sin(phi);
      v.push(cx,cy,cz);n.push(Math.cos(th)*Math.cos(phi),Math.sin(th),Math.cos(th)*Math.sin(phi));u.push(j/segs,i/rings);}}
  for(let i=0;i<rings;i++)for(let j=0;j<segs;j++){const a=i*(segs+1)+j,b=a+segs+1;idx.push(a,b,a+1,b,b+1,a+1);}
  return {pos:new Float32Array(v),norm:new Float32Array(n),uv:new Float32Array(u),idx:new Uint16Array(idx),tris:idx.length/3};
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mkShader(gl: WebGL2RenderingContext, t: number, s: string) {
  const sh=gl.createShader(t)!;gl.shaderSource(sh,s);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(sh));return sh;
}
function mkProg(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const v=mkShader(gl,gl.VERTEX_SHADER,vs),f=mkShader(gl,gl.FRAGMENT_SHADER,fs);
  const p=gl.createProgram()!;gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))console.error(gl.getProgramInfoLog(p));gl.deleteShader(v);gl.deleteShader(f);
  return p;
}
function tex(gl: WebGL2RenderingContext, sz: number) {
  const d=new Uint8Array(sz*sz*4),cs=sz/8;
  for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){const i=(y*sz+x)*4,cx=Math.floor(x/cs)%2,cy=Math.floor(y/cs)%2,w=cx^cy?200:60;d[i]=w;d[i+1]=w+20;d[i+2]=w+40;d[i+3]=255;}
  const t=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,sz,sz,0,gl.RGBA,gl.UNSIGNED_BYTE,d);
  gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  return t;
}
function upload(gl: WebGL2RenderingContext, m: ReturnType<typeof torus>) {
  const vao=gl.createVertexArray()!;gl.bindVertexArray(vao);
  [m.pos,m.norm,m.uv].forEach((d,i)=>{const b=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,i===2?2:3,gl.FLOAT,false,0,0);});
  const ib=gl.createBuffer()!;gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);
  return {vao,count:m.idx.length};
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function Benchmark() {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const [m,setM]=useState<Metrics>({fps:0,frameTimeMs:0,jsHeapMB:0,drawCalls:0,triangleCount:0,textureCount:0,contextCreateMs:0});
  const [r,setR]=useState<TestResult[]>([
    {name:"压力场景 FPS (~100K tris)",status:"pending",value:"-",threshold:">= 60"},
    {name:"Context 创建耗时",status:"pending",value:"-",threshold:"< 500ms"},
    {name:"内存稳定性 (~8s)",status:"pending",value:"-",threshold:"增长 < 50MB"},
    {name:"GPU 信息",status:"pending",value:"-",threshold:"—"},
  ]);
  const [running,setRunning]=useState(false);
  const [phase,setPhase]=useState("按「运行测试」开始");
  const [gpu,setGpu]=useState("");
  const rafRef=useRef(0);
  const mRef=useRef(m);useEffect(()=>{mRef.current=m},[m]);

  const run=useCallback(async()=>{
    setRunning(true);setPhase("创建 WebGL Context...");
    const c=canvasRef.current!;
    const dpr=devicePixelRatio||1;
    const W=Math.max(window.innerWidth,100),H=Math.max(window.innerHeight,100);
    c.width=W*dpr;c.height=H*dpr;c.style.width=W+"px";c.style.height=H+"px";

    const ts=performance.now();
    const gl=c.getContext("webgl2",{alpha:false,antialias:true,depth:true,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:"high-performance"}) as WebGL2RenderingContext|null;
    const ctxMs=performance.now()-ts;
    if(!gl){setPhase("失败：WebGL2 不可用");setRunning(false);return;}

    const di=gl.getExtension("WEBGL_debug_renderer_info");
    const renderer=di?gl.getParameter(di.UNMASKED_RENDERER_WEBGL):"?";
    const vendor=di?gl.getParameter(di.UNMASKED_VENDOR_WEBGL):"?";
    setGpu(`${vendor} / ${renderer}`);
    const isVirtual=/Microsoft Basic Render|GDI Generic/i.test(renderer);

    const prog=mkProg(gl,VS,FS);if(!prog){setPhase("Shader 编译失败");setRunning(false);return;}

    // Meshes: one big torus + many smaller ones
    const meshes:{vao:WebGLVertexArrayObject;count:number;tris:number;texture:WebGLTexture}[]=[];
    let totalTris=0;
    const big=torus(96,192,1.8,0.35);const gBig=upload(gl,big);
    const tBig=tex(gl,1024);meshes.push({...gBig,tris:big.tris,texture:tBig});totalTris+=big.tris;
    const med=torus(48,96,1.2,0.25);const gMed=upload(gl,med);
    const tMed=tex(gl,512);
    for(let i=0;i<8;i++){meshes.push({...gMed,tris:med.tris,texture:tMed});totalTris+=med.tris;}
    const small=torus(16,32,0.6,0.15);const gSmall=upload(gl,small);
    const tSmall=tex(gl,256);
    // Fill remaining to ~100K
    const goal=Math.max(0,Math.floor((100000-totalTris)/small.tris));
    for(let i=0;i<goal;i++){meshes.push({...gSmall,tris:small.tris,texture:tSmall});totalTris+=small.tris;}

    const uMvp=gl.getUniformLocation(prog,"u_mvp")!,uL=gl.getUniformLocation(prog,"u_l")!,uT=gl.getUniformLocation(prog,"u_t")!;

    const proj=mat4.create();mat4.perspective(proj,1.2,W/H,0.1,120);
    const view=mat4.create();mat4.lookAt(view,vec3.fromValues(0,2,8),vec3.fromValues(0,0,0),vec3.fromValues(0,1,0));
    const vp=mat4.create();mat4.multiply(vp,proj,view);

    let frames=0,lastFpsT=performance.now(),ftAcc=0,lastFrameT=performance.now();
    const heapS:number[]=[((performance as any).memory?.usedJSHeapSize??0)/1024/1024];
    let alive=true;

    setPhase("渲染中... 收集指标");

    function frame(){if(!alive)return;const now=performance.now(),dt=now-lastFrameT;lastFrameT=now;ftAcc+=dt;frames++;
      if(now-lastFpsT>=1000){const fps=Math.round(frames/((now-lastFpsT)/1000)),ft=ftAcc/frames,hMB=Math.round(((performance as any).memory?.usedJSHeapSize??0)/1024/1024);heapS.push(hMB);
        setM({fps,frameTimeMs:Math.round(ft*100)/100,jsHeapMB:hMB,drawCalls:meshes.length,triangleCount:totalTris,textureCount:3,contextCreateMs:ctxMs});frames=0;lastFpsT=now;ftAcc=0;}

      // Render direct to canvas — no FBO, confirm visibility first
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.viewport(0,0,W*dpr,H*dpr);gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0.04,0.04,0.08,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);gl.uniform3f(uL,0.4,0.7,0.3);

      const t=now*0.001;
      for(let i=0;i<meshes.length;i++){const m=meshes[i];
        const angle=(i*0.4+t*0.15)%(Math.PI*2),radius=2.5+(i%10)*0.45,height=(Math.floor(i/10)-4)*0.4;
        const model=mat4.create();mat4.translate(model,model,vec3.fromValues(Math.cos(angle)*radius,height,Math.sin(angle)*radius+1));
        mat4.rotateY(model,model,angle);mat4.rotateX(model,model,t*0.25);
        const mvp=mat4.create();mat4.multiply(mvp,vp,model);gl.uniformMatrix4fv(uMvp,false,mvp);
        gl.activeTexture(gl.TEXTURE0);gl.uniform1i(uT,0);
        gl.bindTexture(gl.TEXTURE_2D,m.texture);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);
      }
      rafRef.current=requestAnimationFrame(frame);
    }
    rafRef.current=requestAnimationFrame(frame);

    await new Promise(r=>setTimeout(r,4000));
    const fpsS:number[]=[],startC=performance.now();
    const collect=()=>{fpsS.push(mRef.current.fps);if(performance.now()-startC<5000)setTimeout(collect,200);else done();};
    setTimeout(collect,200);

    function done(){const avgFps=Math.round(fpsS.reduce((a,b)=>a+b,0)/Math.max(1,fpsS.length));
      const h0=heapS[0]??0,h1=heapS[heapS.length-1]??0,g=h1-h0;
      setR([{...r[0],status:avgFps>=60?"pass":"fail",value:`${avgFps} FPS`},{...r[1],status:ctxMs<500?"pass":"fail",value:`${ctxMs.toFixed(1)}ms`},{...r[2],status:g<50?"pass":"fail",value:`${g>0?"+":""}${g} MB`},{...r[3],status:"pass",value:isVirtual?"虚拟适配器":renderer}]);
      setPhase("测试完成 — 点击「返回首页」离开");setRunning(false);cancelAnimationFrame(rafRef.current);}
  },[]);

  useEffect(()=>()=>{cancelAnimationFrame(rafRef.current);},[]);

  return (
    <div className="fixed inset-0 bg-[#0a0a1a] flex">
      {/* Canvas fills entire window */}
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" style={{zIndex:0,display:"block",background:"#050510"}}/>

      {/* UI overlay */}
      <div className="relative z-20 p-4 max-w-[480px] space-y-3 overflow-auto pointer-events-none">
        <a href="/" className="pointer-events-auto inline-block px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-gray-300 hover:text-white transition border border-white/5">← 返回首页</a>

        <div className="pointer-events-auto bg-black/80 backdrop-blur rounded-lg p-4 border border-white/10">
          <h1 className="text-lg font-semibold text-white">WebView2 WebGL 2.0 可行性验证 (阶段 0)</h1>
          <p className="text-xs text-gray-400 mt-1">{gpu||"点击运行测试..."}</p>
          <p className="text-sm text-cyan-400 mt-1">{phase}</p>
        </div>

        {running&&<div className="pointer-events-auto bg-black/80 backdrop-blur rounded-lg p-4 border border-white/10 font-mono text-sm text-white grid grid-cols-2 gap-x-4 gap-y-1">
          <div>FPS <span className="text-cyan-400">{m.fps}</span></div><div>帧时间 <span className="text-cyan-400">{m.frameTimeMs}ms</span></div>
          <div>JS Heap <span className="text-cyan-400">{m.jsHeapMB}MB</span></div><div>DrawCalls <span className="text-cyan-400">{m.drawCalls}</span></div>
          <div>三角面 <span className="text-cyan-400">{(m.triangleCount/1000).toFixed(0)}K</span></div><div>纹理 <span className="text-cyan-400">{m.textureCount}</span></div>
          <div>Context <span className="text-cyan-400">{m.contextCreateMs}ms</span></div>
        </div>}

        <div className="pointer-events-auto bg-black/80 backdrop-blur rounded-lg p-4 border border-white/10">
          <table className="w-full text-sm text-white"><thead><tr className="text-gray-400 border-b border-white/10"><th className="text-left py-1">测试项</th><th className="text-right py-1 w-16">结果</th><th className="text-right py-1 w-24">阈值</th></tr></thead>
            <tbody>{r.map((x,i)=><tr key={i} className="border-b border-white/5 last:border-0"><td className="py-1.5 pr-2">{x.name}</td><td className={`py-1.5 text-right font-mono ${x.status==="pass"?"text-green-400":x.status==="fail"?"text-red-400":x.status==="running"?"text-yellow-400":"text-gray-500"}`}>{x.status==="pending"?"—":x.value}</td><td className="py-1.5 text-right text-gray-500">{x.threshold}</td></tr>)}</tbody></table>
        </div>

        {!running&&<button onClick={run} className="pointer-events-auto bg-cyan-600 hover:bg-cyan-500 transition px-6 py-2.5 rounded-lg text-sm font-medium text-white">运行测试</button>}
        <p className="pointer-events-auto text-[11px] text-gray-600 leading-relaxed">开发环境独有 (阶段0)，生产构建不打包</p>
      </div>
    </div>
  );
}
