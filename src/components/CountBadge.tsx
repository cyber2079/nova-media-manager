export default function CountBadge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span
      className="absolute -top-1.5 -right-6 text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none"
      style={{ color: "var(--color-primary-light)", background: "color-mix(in srgb, var(--color-primary) 12%, transparent)" }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
