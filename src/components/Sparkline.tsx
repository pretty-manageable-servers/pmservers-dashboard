import { useId } from 'react';

export function Sparkline({
  values,
  color = 'var(--accent)',
  height = 36,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const id = useId();
  if (values.length < 2) return null;
  const w = 200;
  const n = values.length;
  const pts = values.map((v, i) => [(i / (n - 1)) * w, height - 2 - v * (height - 6)] as const);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[n - 1]!;
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ height }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w} ${height} L0 ${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  );
}
