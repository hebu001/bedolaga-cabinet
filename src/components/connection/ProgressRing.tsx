interface ProgressRingProps {
  /** Progress percentage 0–100 */
  percent: number;
  /** Size in pixels, default 160 */
  size?: number;
}

const CIRCUMFERENCE = 2 * Math.PI * 46; // r=46 for viewBox 100

export default function ProgressRing({ percent, size = 160 }: ProgressRingProps) {
  const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className="relative z-0"
      style={{ width: size, height: size }}
    >
      {/* Background track */}
      <circle
        cx="50"
        cy="50"
        r="46"
        strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        strokeDashoffset="0"
        transform="rotate(-90 50 50)"
        strokeLinecap="round"
        className="stroke-white/15"
        style={{ strokeWidth: '4px' }}
      />
      {/* Progress arc */}
      <circle
        cx="50"
        cy="50"
        r="46"
        strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        strokeLinecap="round"
        className="stroke-[var(--figma-green)] transition-all duration-700"
        style={{ strokeWidth: '4px' }}
      />
    </svg>
  );
}
