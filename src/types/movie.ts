export interface Movie {
  id: string;
  name: string;
  filePath: string;
  coverPath: string;       // 本地封面路径或默认图URL
  duration: string;        // 格式化时长 "01:23:45"
  durationSeconds: number; // 时长秒数
  resolution: string;      // "1920x1080"
  fileSize: number;        // 字节
  format: string;          // mp4/avi/mkv等
  tags: string[];
  addTime: string;         // ISO时间戳
  status: "processing" | "ready" | "error";
  errorMsg?: string;
  // ── 观看进度（续播）──
  watchPosition: number;    // 上次观看位置（秒）
  watchUpdatedAt: string;   // ISO时间戳
  watched: boolean;         // 已看完（≥95%）
}
