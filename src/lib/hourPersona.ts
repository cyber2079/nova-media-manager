// ── 时段风格标签（四种，取活动最多的时段）──

export function hourPersona(hourly: number[], t: (k: string) => string): string {
  const total = hourly.reduce((a, b) => a + b, 0);
  if (total < 5) return "";
  const sum = (a: number, b: number) => hourly.slice(a, b).reduce((x, y) => x + y, 0);
  const zones = [
    { label: t("dashboard.hourly_night"), v: sum(0, 6) },
    { label: t("dashboard.hourly_morning"), v: sum(6, 12) },
    { label: t("dashboard.hourly_afternoon"), v: sum(12, 18) },
    { label: t("dashboard.hourly_evening"), v: sum(18, 24) },
  ];
  return zones.reduce((a, b) => (b.v > a.v ? b : a)).label;
}
