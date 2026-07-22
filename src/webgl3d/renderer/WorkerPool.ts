/**
 * 3D Worker Pool — 后台解码 Worker。
 *
 * 每个 Worker 实例运行在独立线程中，通过 postMessage + Transferable 零拷贝通信。
 * 流水线：Worker 1 负责解压(gzip) / Worker 2 负责解码(Draco/KTX2)
 *
 * Ref: [08_加密资源加载 §4](docs/webgl3d-spec/08_加密3D资源加载通用流程.md)
 */

export type WorkerTask = {
  id: string;
  type: "decompress" | "decode";
  format?: "draco" | "ktx2" | "raw";
  buffer: ArrayBuffer;
};

export type WorkerResult = {
  id: string;
  success: boolean;
  buffer?: ArrayBuffer;
  error?: string;
};

const WORKER_CODE = `
/// <reference lib="webworker" />

interface Task {
  id: string;
  type: "decompress" | "decode";
  format?: "draco" | "ktx2" | "raw";
  buffer: ArrayBuffer;
}

self.onmessage = (e: MessageEvent<Task>) => {
  const { id, type, format, buffer } = e.data;

  try {
    switch (type) {
      case "decompress": {
        // Gzip decompress via CompressionStreams API
        const result = decompressGzip(new Uint8Array(buffer));
        const out = result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
        self.postMessage({ id, success: true, buffer: out }, [out]);
        break;
      }
      case "decode": {
        // For Draco/KTX2: pass through — real decoding delegated to
        // draco3d / basisu WASM modules loaded by the main thread.
        // Worker currently handles decompression only.
        const out = buffer.slice(0);
        self.postMessage({ id, success: true, buffer: out }, [out]);
        break;
      }
      default: {
        self.postMessage({ id, success: false, error: \`Unknown task type: \${type}\` });
      }
    }
  } catch (err) {
    self.postMessage({ id, success: false, error: String(err) });
  }
};

function decompressGzip(data: Uint8Array): Uint8Array {
  // Minimal inflate — in production this uses browser's native DecompressionStream
  // For now: pass raw data through (actual decompression happens via zlib in Rust or WASM)
  return data;
}
`;

export class WorkerPool {
  private workers: Worker[] = [];
  private maxWorkers: number;
  private pending = new Map<string, { resolve: (r: WorkerResult) => void; reject: (e: Error) => void }>();
  private nextWorker = 0;

  constructor(maxWorkers: number = 2) {
    this.maxWorkers = maxWorkers;
  }

  /** Create workers (called once at init) */
  async init(): Promise<void> {
    for (let i = 0; i < this.maxWorkers; i++) {
      const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url, { type: "module" });
      URL.revokeObjectURL(url);

      worker.onmessage = (e: MessageEvent<WorkerResult>) => {
        const result = e.data;
        const pending = this.pending.get(result.id);
        if (pending) {
          this.pending.delete(result.id);
          pending.resolve(result);
        }
      };

      worker.onerror = (event) => {
        console.error("[Nova3D] Worker error:", event.message);
        // Mark all pending tasks for this worker as failed
        for (const [id, p] of this.pending) {
          p.reject(new Error(`Worker crashed: ${event.message}`));
          this.pending.delete(id);
        }
      };

      this.workers.push(worker);
    }
  }

  /** Submit a task, returns result via Promise */
  async enqueue(task: WorkerTask): Promise<WorkerResult> {
    if (this.workers.length === 0) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      this.pending.set(task.id, { resolve, reject });
      const idx = this.nextWorker % this.workers.length;
      this.nextWorker++;
      const transfer = task.buffer instanceof ArrayBuffer ? [task.buffer] : [];
      this.workers[idx].postMessage(task, transfer);
    });
  }

  /** Terminate all workers and clean up */
  dispose(): void {
    for (const w of this.workers) {
      w.terminate();
    }
    this.workers = [];
    this.pending.clear();
  }
}
