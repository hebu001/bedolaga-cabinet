import { sanitizeColor } from './types';

/** Keep saved Aurora selections compatible, without animation or a WebGL render loop. */
export default function AuroraBackground({ settings }: { settings: Record<string, unknown> }) {
  const first = sanitizeColor(settings.firstColor, '#00d2ff');
  const second = sanitizeColor(settings.secondColor, '#7928ca');
  const third = sanitizeColor(settings.thirdColor, '#ff0080');
  return (
    <div aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: '#101015' }}>
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.35,
          backgroundImage: `radial-gradient(ellipse at 15% 25%, ${first}, transparent 60%), radial-gradient(ellipse at 80% 30%, ${second}, transparent 65%), radial-gradient(ellipse at 55% 90%, ${third}, transparent 60%)`,
        }}
      />
    </div>
  );
}
