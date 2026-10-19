export function ColorSlider({
  label,
  value,
  min,
  max,
  onChange,
  suffix = '',
  gradient,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  suffix?: string;
  gradient: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-[var(--color-paper)]">{label}</span>
        <span className="font-mono text-xs text-[var(--color-muted)] tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="slider-track"
        style={{ background: gradient }}
        aria-label={label}
      />
    </div>
  );
}
