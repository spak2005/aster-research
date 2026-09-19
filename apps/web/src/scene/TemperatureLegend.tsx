import { temperatureGradientCss } from './temperatureScale';

interface TemperatureLegendProps {
  scale: [number, number];
  compact?: boolean;
}

function formatTemperature(value: number) {
  if (Math.abs(value) >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

export function TemperatureLegend({
  scale,
  compact = false,
}: TemperatureLegendProps) {
  const midpoint = (scale[0] + scale[1]) / 2;

  return (
    <aside
      aria-label={`Fixed temperature color scale from ${scale[0]} to ${scale[1]} kiloelectronvolts`}
      style={{
        position: 'absolute',
        right: 14,
        bottom: 14,
        width: compact ? 154 : 210,
        padding: compact ? '8px 9px' : '10px 11px',
        border: '1px solid rgba(122, 177, 181, 0.2)',
        borderRadius: 5,
        background: 'rgba(3, 10, 12, 0.76)',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
          color: '#9fc1c4',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        <span>Mean Tₑ / Tᵢ</span>
        <span>keV · fixed</span>
      </div>
      <div
        style={{
          height: compact ? 6 : 8,
          borderRadius: 2,
          background: temperatureGradientCss(),
          boxShadow: '0 0 16px rgba(73, 161, 162, 0.12)',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 5,
          color: '#789ca0',
          fontSize: 9,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{formatTemperature(scale[0])}</span>
        <span>{formatTemperature(midpoint)}</span>
        <span>{formatTemperature(scale[1])}</span>
      </div>
    </aside>
  );
}
