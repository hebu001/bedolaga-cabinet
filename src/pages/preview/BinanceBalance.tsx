import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#fcd535',
  primaryActive: '#f0b90b',
  canvas: '#0b0e11',
  card: '#1e2329',
  elevated: '#2b3139',
  body: '#eaecef',
  muted: '#707a8a',
  mutedStrong: '#929aa5',
  hairline: '#2b3139',
  up: '#0ecb81',
  down: '#f6465d',
};

const font =
  '"Binance Plex", "IBM Plex Sans", system-ui, -apple-system, Arial, sans-serif';

const methods = [
  { name: 'Bank Card', sub: 'Visa / MC / MIR', tag: 'Instant' },
  { name: 'Crypto', sub: 'USDT / BTC / TON', tag: 'Low fee' },
  { name: 'Telegram Stars', sub: 'Via bot', tag: 'Instant' },
];

const txs = [
  { date: '05-12 14:08', desc: 'Deposit · Card', amount: '+1,000.00', up: true },
  { date: '05-08 03:00', desc: 'Premium renewal', amount: '-290.00', up: false },
  { date: '05-03 19:22', desc: 'Promo BEDOLAGA10', amount: '+50.00', up: true },
  { date: '04-28 09:41', desc: 'Deposit · USDT', amount: '+2,500.00', up: true },
];

export default function BinanceBalance() {
  return (
    <MobileFrame label="Binance · Balance" bg={c.canvas} fg={c.body}>
      <div style={{ padding: '6px 16px 0', fontFamily: font }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 2px 6px',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Wallet</h1>
          <span style={{ fontSize: 12, color: c.muted }}>Spot ▾</span>
        </div>

        <div
          style={{
            marginTop: 8,
            background: c.card,
            borderRadius: 8,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 12, color: c.muted }}>
            Estimated Balance
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 600 }}>2,450.00</span>
            <span style={{ fontSize: 14, color: c.muted }}>₽</span>
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: c.up,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            +180.00 ₽ (+7.93%) Today
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              style={{
                flex: 1,
                background: c.primary,
                color: '#181a20',
                border: 'none',
                borderRadius: 8,
                padding: '11px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: font,
              }}
            >
              Deposit
            </button>
            <button
              style={{
                flex: 1,
                background: c.elevated,
                color: c.body,
                border: 'none',
                borderRadius: 8,
                padding: '11px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: font,
              }}
            >
              Promo Code
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
          }}
        >
          {['Transfer', 'Convert', 'Earn', 'History'].map((a) => (
            <button
              key={a}
              style={{
                background: 'transparent',
                border: 'none',
                color: c.body,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: font,
                padding: '6px 0',
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: c.card,
                  display: 'grid',
                  placeItems: 'center',
                  color: c.primary,
                  fontSize: 16,
                }}
              >
                ◇
              </span>
              {a}
            </button>
          ))}
        </div>

        <SectionTitle>Deposit Methods</SectionTitle>
        <div
          style={{
            background: c.card,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {methods.map((m, i) => (
            <div
              key={m.name}
              style={{
                padding: '13px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom:
                  i === methods.length - 1 ? 'none' : `1px solid ${c.hairline}`,
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    background: c.elevated,
                    display: 'grid',
                    placeItems: 'center',
                    color: c.primary,
                    fontSize: 14,
                  }}
                >
                  ◈
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
                    {m.sub}
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: c.primary,
                  background: 'rgba(252,213,53,0.10)',
                  borderRadius: 4,
                  padding: '3px 7px',
                }}
              >
                {m.tag}
              </span>
            </div>
          ))}
        </div>

        <SectionTitle>Transaction History</SectionTitle>
        <div
          style={{
            background: c.card,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {txs.map((t, i) => (
            <div
              key={i}
              style={{
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom:
                  i === txs.length - 1 ? 'none' : `1px solid ${c.hairline}`,
              }}
            >
              <div>
                <div style={{ fontSize: 13 }}>{t.desc}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: c.muted,
                    marginTop: 2,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {t.date}
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: t.up ? c.up : c.down,
                }}
              >
                {t.amount}
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="balance"
        links={{
          balance: '/preview/binance/balance',
          subscription: '/preview/binance/subscription',
        }}
        bg="rgba(11,14,17,0.95)"
        fgMute={c.muted}
        accent={c.primary}
      />
    </MobileFrame>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 18,
        marginBottom: 8,
        fontSize: 14,
        fontWeight: 600,
        color: '#eaecef',
        padding: '0 2px',
      }}
    >
      {children}
    </div>
  );
}
