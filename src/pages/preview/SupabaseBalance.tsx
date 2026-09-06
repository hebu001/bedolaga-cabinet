import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#3ecf8e',
  primarySoft: '#4ade80',
  canvasNight: '#1c1c1c',
  canvasNightSoft: '#202020',
  surface: '#262626',
  ink: '#ededed',
  inkMute: '#a1a1a1',
  inkFaint: '#707070',
  hairline: '#2f2f2f',
};

const mono = '"Berkeley Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace';

const txs = [
  { ts: '12 May · 14:08', kind: 'topup', method: 'card', delta: '+1000.00' },
  { ts: '08 May · 03:00', kind: 'renewal', method: 'balance', delta: '-290.00' },
  { ts: '03 May · 19:22', kind: 'promo', method: 'BEDOLAGA10', delta: '+50.00' },
  { ts: '28 Apr · 09:41', kind: 'topup', method: 'usdt', delta: '+2500.00' },
];

export default function SupabaseBalance() {
  return (
    <MobileFrame label="Supabase · Balance" bg={c.canvasNight} fg={c.ink}>
      <div
        style={{
          padding: '4px 14px 0',
          fontFamily: '"Custom Inter", "Inter", system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ padding: '6px 4px 4px' }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              color: c.inkFaint,
              marginBottom: 4,
            }}
          >
            // billing.balance
          </div>
          <h1
            style={{
              fontFamily: mono,
              fontSize: 22,
              fontWeight: 500,
              margin: 0,
              color: c.ink,
            }}
          >
            # balance
          </h1>
        </div>

        <Panel title="balance.current" badge="OK">
          <div
            style={{
              fontFamily: mono,
              fontSize: 12,
              color: c.inkMute,
              marginBottom: 10,
            }}
          >
            $ get-balance --user=me
          </div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 32,
              fontWeight: 600,
              color: c.ink,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            2,450.00 <span style={{ color: c.primary, fontSize: 18, fontWeight: 500 }}>₽</span>
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: mono,
              fontSize: 11,
              color: c.primarySoft,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ▲ +180.00 ₽ · week
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button
              style={{
                flex: 1,
                background: c.primary,
                color: '#0a0a0a',
                border: 'none',
                borderRadius: 6,
                padding: '10px',
                fontFamily: mono,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              $ topup
            </button>
            <button
              style={{
                flex: 1,
                background: 'transparent',
                color: c.ink,
                border: `1px solid ${c.hairline}`,
                borderRadius: 6,
                padding: '10px',
                fontFamily: mono,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              $ promo --apply
            </button>
          </div>
        </Panel>

        <Panel title="payment_methods">
          <div
            style={{
              fontFamily: mono,
              fontSize: 10,
              color: c.inkFaint,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'grid',
              gridTemplateColumns: '80px 1fr 70px',
              gap: 8,
              paddingBottom: 6,
              borderBottom: `1px solid ${c.hairline}`,
            }}
          >
            <span>provider</span>
            <span>detail</span>
            <span style={{ textAlign: 'right' }}>status</span>
          </div>
          {[
            { p: 'card', d: '•••• 4242', s: 'ready' },
            { p: 'crypto', d: 'USDT,BTC,TON', s: 'ready' },
            { p: 'stars', d: 'Telegram', s: 'ready' },
          ].map((m, i, arr) => (
            <div
              key={m.p}
              style={{
                fontFamily: mono,
                fontSize: 12,
                display: 'grid',
                gridTemplateColumns: '80px 1fr 70px',
                gap: 8,
                padding: '8px 0',
                borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${c.hairline}`,
                color: c.ink,
              }}
            >
              <span>{m.p}</span>
              <span style={{ color: c.inkMute }}>{m.d}</span>
              <span style={{ color: c.primary, textAlign: 'right' }}>{m.s}</span>
            </div>
          ))}
        </Panel>

        <Panel title="transactions" badge="LIVE">
          {txs.map((tx, i) => {
            const positive = tx.delta.startsWith('+');
            return (
              <div
                key={i}
                style={{
                  padding: '10px 0',
                  borderBottom: i === txs.length - 1 ? 'none' : `1px solid ${c.hairline}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  fontFamily: mono,
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ color: c.inkFaint, fontSize: 10 }}>{tx.ts}</div>
                  <div style={{ color: c.ink, marginTop: 2 }}>
                    {tx.kind} <span style={{ color: c.inkMute }}>· {tx.method}</span>
                  </div>
                </div>
                <span
                  style={{
                    color: positive ? c.primary : '#f87171',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    alignSelf: 'center',
                  }}
                >
                  {tx.delta}
                </span>
              </div>
            );
          })}
        </Panel>

        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="balance"
        links={{
          balance: '/preview/supabase/balance',
          subscription: '/preview/supabase/subscription',
        }}
        bg="rgba(28,28,28,0.92)"
        fgMute={c.inkMute}
        accent={c.primary}
      />
    </MobileFrame>
  );
}

function Panel({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        background: c.canvasNightSoft,
        border: `1px solid ${c.hairline}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${c.hairline}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: mono,
          fontSize: 11,
          color: c.inkMute,
        }}
      >
        <span>{title}</span>
        {badge && (
          <span
            style={{
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 3,
              background: 'rgba(62,207,142,0.12)',
              color: c.primary,
              letterSpacing: '0.08em',
              border: '1px solid rgba(62,207,142,0.32)',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}
