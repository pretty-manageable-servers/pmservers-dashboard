import { Sparkline } from './Sparkline';

export function UsageCard(props: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  prefix?: string;
  series: number[];
  color?: string;
}) {
  const { label, used, limit, unit = '', prefix = '', series, color } = props;
  const pct = limit ? (used / limit) * 100 : 0;
  return (
    <div className="ucard">
      <div className="k">
        <span>{label}</span>
        <span className="num">{Math.round(pct)}%</span>
      </div>
      <div className="v">
        {prefix}
        {used}
        {unit}
        <small>
          {' '}
          / {prefix}
          {limit}
          {unit}
        </small>
      </div>
      <Sparkline values={series} color={color} height={44} />
      <div
        className="bar-mini"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i className={pct > 75 ? 'hi' : ''} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
