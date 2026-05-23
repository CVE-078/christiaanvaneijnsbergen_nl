interface Props {
  filled: number;
  total: number;
  color: string;
}

export default function ProgressBar({ filled, total, color }: Props) {
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: i < filled ? color : '#2a2a2a',
          }}
        />
      ))}
    </div>
  );
}
