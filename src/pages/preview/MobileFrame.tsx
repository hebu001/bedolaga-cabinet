import { Link } from 'react-router';
import type { ReactNode } from 'react';

type Props = {
  label: string;
  bg: string;
  fg: string;
  navTint?: string;
  children: ReactNode;
};

export function MobileFrame({ label, bg, fg, navTint, children }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#08080a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 12px 48px',
        gap: 14,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#a1a1aa',
          fontSize: 12,
          fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
        }}
      >
        <Link
          to="/preview"
          style={{
            color: navTint ?? '#a1a1aa',
            textDecoration: 'none',
          }}
        >
          ← All previews
        </Link>
        <span style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          minHeight: 780,
          background: bg,
          color: fg,
          borderRadius: 32,
          overflow: 'hidden',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.06), 0 40px 80px rgba(0,0,0,0.45)',
          position: 'relative',
        }}
      >
        <FakeStatusBar fg={fg} />
        {children}
      </div>
    </div>
  );
}

function FakeStatusBar({ fg }: { fg: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 24px 6px',
        fontSize: 13,
        fontWeight: 600,
        color: fg,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        opacity: 0.85,
      }}
    >
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>9:41</span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11 }}>•••</span>
        <span style={{ fontSize: 11 }}>📶</span>
        <span
          style={{
            width: 22,
            height: 10,
            border: `1px solid ${fg}`,
            opacity: 0.6,
            borderRadius: 3,
            position: 'relative',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 1,
              left: 1,
              right: 5,
              bottom: 1,
              background: fg,
              borderRadius: 1,
            }}
          />
        </span>
      </span>
    </div>
  );
}

export function MobileTabBar({
  active,
  links,
  bg,
  fgMute,
  accent,
}: {
  active: 'balance' | 'subscription';
  links: { balance: string; subscription: string };
  bg: string;
  fgMute: string;
  accent: string;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        background: bg,
        borderTop: `1px solid ${accent}22`,
        padding: '12px 20px calc(12px + env(safe-area-inset-bottom))',
        display: 'flex',
        justifyContent: 'space-around',
        gap: 12,
      }}
    >
      <Link
        to={links.balance}
        style={{
          flex: 1,
          textAlign: 'center',
          padding: '10px 8px',
          borderRadius: 10,
          color: active === 'balance' ? accent : fgMute,
          background:
            active === 'balance' ? `${accent}18` : 'transparent',
          fontWeight: active === 'balance' ? 600 : 500,
          fontSize: 13,
          textDecoration: 'none',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Баланс
      </Link>
      <Link
        to={links.subscription}
        style={{
          flex: 1,
          textAlign: 'center',
          padding: '10px 8px',
          borderRadius: 10,
          color: active === 'subscription' ? accent : fgMute,
          background:
            active === 'subscription' ? `${accent}18` : 'transparent',
          fontWeight: active === 'subscription' ? 600 : 500,
          fontSize: 13,
          textDecoration: 'none',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Подписка
      </Link>
    </div>
  );
}

