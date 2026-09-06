import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#5e6ad2',
  primaryHover: '#828fff',
  ink: '#f7f8f8',
  inkMuted: '#d0d6e0',
  inkSubtle: '#8a8f98',
  inkTertiary: '#62666d',
  canvas: '#010102',
  surface1: '#0f1011',
  surface2: '#141516',
  surface3: '#18191a',
  hairline: '#23252a',
};

const txs = [
  { date: 'May 12', desc: 'Top-up · card', amount: '+₽1,000', positive: true },
  { date: 'May 08', desc: 'Premium renewal', amount: '−₽290', positive: false },
  { date: 'May 03', desc: 'Promo BEDOLAGA10', amount: '+₽50', positive: true },
  { date: 'Apr 28', desc: 'Top-up · USDT', amount: '+₽2,500', positive: true },
];

export default function LinearBalance() {
  return (
    <MobileFrame label="Linear · Balance" bg={c.canvas} fg={c.ink}>
      <div
        style={{
          padding: '4px 16px 0',
          fontFamily: '"Inter Display", "Inter", system-ui, -apple-system, sans-serif',
          fontFeatureSettings: '"cv11"',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 4px 6px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: c.inkSubtle,
              }}
            >
              Account
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: 0,
                marginTop: 4,
              }}
            >
              Balance
            </h1>
          </div>
          <kbd
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10,
              color: c.inkSubtle,
              background: c.surface3,
              border: `1px solid ${c.hairline}`,
              borderRadius: 4,
              padding: '3px 7px',
            }}
          >
            ⌘ K
          </kbd>
        </div>

        <div
          style={{
            marginTop: 12,
            background: c.surface1,
            border: `1px solid ${c.hairline}`,
            borderRadius: 10,
            padding: '18px 18px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: c.inkSubtle,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Available
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'baseline',
              gap: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em' }}>₽2,450</span>
            <span style={{ fontSize: 18, color: c.inkSubtle, fontWeight: 500 }}>.00</span>
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: c.inkSubtle,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            +₽180 this week
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button
              style={{
                flex: 1,
                background: c.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Top up
            </button>
            <button
              style={{
                flex: 1,
                background: c.surface2,
                color: c.ink,
                border: `1px solid ${c.hairline}`,
                borderRadius: 6,
                padding: '10px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Promo code
            </button>
          </div>
        </div>

        <SectionLabel>Payment methods</SectionLabel>
        <div
          style={{
            background: c.surface1,
            border: `1px solid ${c.hairline}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {[
            { name: 'Card', sub: 'Visa •••• 4242', tag: 'Default', tagColor: c.primary },
            { name: 'Crypto', sub: 'USDT, BTC, TON', tag: 'Active', tagColor: c.inkMuted },
            { name: 'Telegram Stars', sub: 'Via bot', tag: 'Active', tagColor: c.inkMuted },
          ].map((m, i, arr) => (
            <div
              key={m.name}
              style={{
                padding: '12px 14px',
                borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${c.hairline}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div>{m.name}</div>
                <div style={{ color: c.inkSubtle, fontSize: 11, marginTop: 2 }}>{m.sub}</div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: m.tagColor,
                  border: `1px solid ${m.tag === 'Default' ? c.primary : c.hairline}`,
                  borderRadius: 4,
                  padding: '2px 7px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 500,
                }}
              >
                {m.tag}
              </span>
            </div>
          ))}
        </div>

        <SectionLabel>
          Transactions
          <span style={{ color: c.inkTertiary, marginLeft: 8 }}>·</span>
          <span style={{ color: c.inkSubtle, fontWeight: 400 }}> 4 items</span>
        </SectionLabel>
        <div
          style={{
            background: c.surface1,
            border: `1px solid ${c.hairline}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {txs.map((tx, i) => (
            <div
              key={i}
              style={{
                padding: '12px 14px',
                borderBottom: i === txs.length - 1 ? 'none' : `1px solid ${c.hairline}`,
                display: 'grid',
                gridTemplateColumns: '64px 1fr auto',
                gap: 8,
                alignItems: 'center',
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ color: c.inkSubtle, fontSize: 11 }}>{tx.date}</span>
              <span>{tx.desc}</span>
              <span
                style={{
                  color: tx.positive ? '#86efac' : c.ink,
                  fontWeight: 500,
                }}
              >
                {tx.amount}
              </span>
            </div>
          ))}
        </div>

        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="balance"
        links={{
          balance: '/preview/linear/balance',
          subscription: '/preview/linear/subscription',
        }}
        bg="rgba(1,1,2,0.92)"
        fgMute={c.inkSubtle}
        accent={c.primary}
      />
    </MobileFrame>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 18,
        marginBottom: 8,
        padding: '0 4px',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#8a8f98',
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}
