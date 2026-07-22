/**
 * 3D 模块统一错误码枚举。
 *
 * 格式：NV3D_{CATEGORY}_{SPECIFIC}
 * 所有 3D 模块异常使用统一错误码，确保日志、前端提示、AI 生成的异常处理代码引用同一套语义。
 *
 * Ref: [02_全局开发强制标准 §9](docs/webgl3d-spec/02_全局开发强制标准.md)
 */

export const ErrorCodes = {
  // ── 资源加载 (LOAD) ──────────────────────────────────────────────
  LOAD_FILE_OPEN:          "NV3D_LOAD_FILE_OPEN",
  LOAD_SIGN_INVALID:       "NV3D_LOAD_SIGN_INVALID",
  LOAD_MAGIC_MISMATCH:     "NV3D_LOAD_MAGIC_MISMATCH",
  LOAD_MANIFEST_HASH:      "NV3D_LOAD_MANIFEST_HASH",
  LOAD_MANIFEST_JSON:      "NV3D_LOAD_MANIFEST_JSON",
  LOAD_BLOCK_HASH:         "NV3D_LOAD_BLOCK_HASH",
  LOAD_BLOCK_MISSING:      "NV3D_LOAD_BLOCK_MISSING",
  LOAD_EXT_UNSUPPORTED:    "NV3D_LOAD_EXT_UNSUPPORTED",
  LOAD_GENERIC:            "NV3D_LOAD_GENERIC",
  LOAD_DOWNLOAD_FAIL:      "NV3D_LOAD_DOWNLOAD_FAIL",

  // ── 渲染 (RNDR) ──────────────────────────────────────────────────
  RNDR_CTX_CREATE:         "NV3D_RNDR_CTX_CREATE",
  RNDR_CTX_LOST:           "NV3D_RNDR_CTX_LOST",
  RNDR_CTX_RESTORE_FAIL:   "NV3D_RNDR_CTX_RESTORE_FAIL",
  RNDR_SHADER_COMPILE:     "NV3D_RNDR_SHADER_COMPILE",
  RNDR_SHADER_TIMEOUT:     "NV3D_RNDR_SHADER_TIMEOUT",
  RNDR_SHADER_LINK:        "NV3D_RNDR_SHADER_LINK",
  RNDR_FRAME_TIMEOUT:      "NV3D_RNDR_FRAME_TIMEOUT",

  // ── 内存/资源 (MEM) ──────────────────────────────────────────────
  MEM_OOM_WARNING:         "NV3D_MEM_OOM_WARNING",
  MEM_OOM_CRITICAL:        "NV3D_MEM_OOM_CRITICAL",
  MEM_LEAK_DETECTED:       "NV3D_MEM_LEAK_DETECTED",
  MEM_CACHE_OVERFLOW:      "NV3D_MEM_CACHE_OVERFLOW",

  // ── Worker (WKR) ─────────────────────────────────────────────────
  WKR_CRASH:               "NV3D_WKR_CRASH",
  WKR_DECODE_FAIL:         "NV3D_WKR_DECODE_FAIL",
  WKR_INIT_FAIL:           "NV3D_WKR_INIT_FAIL",

  // ── 接口/权限 (AUTH) ─────────────────────────────────────────────
  AUTH_DISABLED:           "NV3D_AUTH_DISABLED",
  AUTH_PREMIUM_REQUIRED:   "NV3D_AUTH_PREMIUM_REQUIRED",
  AUTH_LICENSE_EXPIRED:    "NV3D_AUTH_LICENSE_EXPIRED",

  // ── 素材/校验 (ASST) ─────────────────────────────────────────────
  ASST_FACE_COUNT:         "NV3D_ASST_FACE_COUNT",
  ASST_RESOLUTION:         "NV3D_ASST_RESOLUTION",
  ASST_NAMING:             "NV3D_ASST_NAMING",
  ASST_MISSING_FILE:       "NV3D_ASST_MISSING_FILE",
  ASST_REF_INVALID:        "NV3D_ASST_REF_INVALID",

  // ── 交互 (INTR) ─────────────────────────────────────────────────
  INTR_CONFIG_PARSE:       "NV3D_INTR_CONFIG_PARSE",
  INTR_ANIM_MISSING:        "NV3D_INTR_ANIM_MISSING",
  INTR_CONDITION_ERROR:    "NV3D_INTR_CONDITION_ERROR",
  INTR_ACTION_FAILED:      "NV3D_INTR_ACTION_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
