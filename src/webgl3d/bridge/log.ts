/**
 * 3D 模块崩溃日志。
 *
 * 日志格式：[Nova3D] YYYY-MM-DD HH:MM:SS | LEVEL | ERROR_CODE | MESSAGE
 * Ref: [02_全局开发强制标准 §6](docs/webgl3d-spec/02_全局开发强制标准.md)
 */

import type { ErrorCode } from "./errorCodes";

type LogLevel = "INFO" | "WARN" | "ERROR";

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function format(level: LogLevel, code: ErrorCode | string, message: string): string {
  return `[Nova3D] ${timestamp()} | ${level} | ${code} | ${message}`;
}

export const log3D = {
  info(code: ErrorCode | string, message: string) {
    console.info(format("INFO", code, message));
  },
  warn(code: ErrorCode | string, message: string) {
    console.warn(format("WARN", code, message));
  },
  error(code: ErrorCode | string, message: string) {
    console.error(format("ERROR", code, message));
  },
};
