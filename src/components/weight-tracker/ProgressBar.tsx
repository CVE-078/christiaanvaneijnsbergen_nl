interface Props {
  filled: number;
  total: number;
  color: string;
}

const MONO = "var(--pulse-mono, 'JetBrains Mono', 'Courier New', monospace)";

export default function ProgressBar({ filled, total, color }: Props) {
  return (
    <span style={{ fontFamily: MONO, fontSize: '0.875rem', letterSpacing: '0.05em', flexShrink: 0 }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ color: i < filled ? color : '#3a3a3a' }}>
          {i < filled ? '█' : '░'}
        </span>
      ))}
    </span>
  );
}
