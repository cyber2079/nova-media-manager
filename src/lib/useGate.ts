import { useLicenseStore } from "@/stores/licenseStore";

/**
 * Feature flags gated by license tier.
 *
 * Gating philosophy:
 * - Free users get a complete, non-crippled media manager.
 * - Paid tiers unlock content (premium themes) and infrastructure
 *   (cloud sync, auto-update).
 * - Never gate basic tool features — those are table stakes.
 * - One-code-one-machine is enforced server-side, not via feature flag.
 */
export type FeatureFlag =
  | "premium-theme"    // non-default themes (ice-girl, cyber-girl, …)
  | "auto-update"      // staged-rollout update channel
  | "cloud-sync";       // cross-device data sync

/**
 * Returns true when the current license tier is entitled to `feature`.
 * Purely reactive — re-renders when the license store changes.
 */
export function useGate(feature: FeatureFlag): boolean {
  const tier = useLicenseStore((s) => s.license.tier);

  switch (feature) {
    case "premium-theme":
    case "auto-update":
      return tier !== "free";

    case "cloud-sync":
      return tier === "ultra" || tier === "custom";

    default:
      return false;
  }
}
