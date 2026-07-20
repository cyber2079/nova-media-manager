import { useLicenseStore } from "@/stores/licenseStore";

export type FeatureFlag = "premium-theme" | "auto-update";

/** 本地即时过期校验（不依赖服务端轮询） */
function isExpiredLocally(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return Date.now() > new Date(expiresAt).getTime();
}

export function useGate(feature: FeatureFlag): boolean {
  const license = useLicenseStore((s) => s.license);

  // 先检查本地过期（即时降级，不等 7 天轮询）
  if (license.tier !== "free" && isExpiredLocally(license.expiresAt)) {
    return false;
  }

  // Member 解锁所有付费功能
  return license.tier !== "free";
}
