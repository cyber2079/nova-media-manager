export interface ImageItem {
  id: string;
  name: string;
  filePath: string;
  coverPath: string;       // 缩略图路径
  resolution: string;      // "1920x1080"
  fileSize: number;        // 字节
  width: number;
  height: number;
  tags: string[];
  addTime: string;
}
