import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  ink: '#ffffff',
  body: '#cccccc',
  bodyStrong: '#e6e6e6',
  muted: '#999999',
  mutedSoft: '#666666',
  hairline: '#262626',
  hairlineStrong: '#3a3a3a',
  canvas: '#000000',
  surfaceSoft: '#0d0d0d',
  surfaceCard: '#141414',
  surfaceElevated: '#1f1f1f',
};

const font = '"Bugatti", "Times New Roman", Georgia, "Helvetica Neue", serif';
const sans = '"Helvetica Neue", Arial, sans-serif';

const methods = [
  { name: 'Bank card', sub: 'Visa · Mastercard · MIR' },
  { name: 'Cryptocurrency', sub: 'USDT · BTC · TON' },
  { name: 'Telegram Stars', sub: 'Via bot' },
];

const txs = [
  { date: '12 MAY', desc: 'Top-up · Card', amount: '+₽1 000' },
  { date: '08 MAY', desc: 'Premium · renewal', amount: '−₽290' },
  { date: '03 MAY', desc: 'Promo BEDOLAGA10', amount: '+₽50' },
  { date: '28 APR', desc: 'Top-up · USDT', amount: '+₽2 500' },
];

export default function BugattiBalance() {
  return (
    <MobileFrame label="Bugatti · Balance" bg={c.canvas} fg={c.ink}>
      <div style={{ padding: '10px 20px 0' }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            color: c.mutedSoft,
            padding: '10px 0 14px',
            fontFamily: sans,
          }}
        >
          Account
        </div>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 300,
            letterSpacing: '0.02em',
            margin: 0,
            lineHeight: 1,
            fontFamily: font,
          }}
        >
          Balance
        </h1>
        <div
          style={{
            marginTop: 6,
            height: 1,
            background: c.hairlineStrong,
          }}
        />

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              color: c.mutedSoft,
              fontFamily: sans,
            }}
          >
            Available
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 52,
              fontWeight: 300,
              letterSpacing: '0.01em',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: font,
              lineHeight: 1,
            }}
          >
            ₽2 450
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: c.muted,
              fontFamily: sans,
            }}
          >
            +₽180 this week
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          <button
            style={{
              flex: 1,
              background: c.ink,
              color: '#000',
              border: 'none',
              borderRadius: 0,
              padding: '15px',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: sans,
            }}
          >
            Top up
          </button>
          <button
            style={{
              flex: 1,
              background: 'transparent',
              color: c.ink,
              border: `1px solid ${c.hairlineStrong}`,
              borderRadius: 0,
              padding: '15px',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: sans,
            }}
          >
            Promo
          </button>
        </div>

        <SectionTitle>Payment methods</SectionTitle>
        {methods.map((m, i) => (
          <div
            key={m.name}
            style={{
              padding: '18px 2px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: `1px solid ${c.hairline}`,
              borderBottom: i === methods.length - 1 ? `1px solid ${c.hairline}` : 'none',
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 300, fontFamily: font }}>{m.name}</div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: c.mutedSoft,
                  marginTop: 5,
                  fontFamily: sans,
                }}
              >
                {m.sub}
              </div>
            </div>
            <span style={{ color: c.muted, fontSize: 14 }}>→</span>
          </div>
        ))}

        <SectionTitle>History</SectionTitle>
        {txs.map((t, i) => (
          <div
            key={i}
            style={{
              padding: '16px 2px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: `1px solid ${c.hairline}`,
              borderBottom: i === txs.length - 1 ? `1px solid ${c.hairline}` : 'none',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 300, fontFamily: font }}>{t.desc}</div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '0.2em',
                  color: c.mutedSoft,
                  marginTop: 4,
                  fontFamily: sans,
                }}
              >
                {t.date}
              </div>
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 300,
                fontVariantNumeric: 'tabular-nums',
                fontFamily: font,
                color: c.bodyStrong,
              }}
            >
              {t.amount}
            </div>
          </div>
        ))}
        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="balance"
        links={{
          balance: '/preview/bugatti/balance',
          subscription: '/preview/bugatti/subscription',
        }}
        bg="rgba(0,0,0,0.95)"
        fgMute={c.mutedSoft}
        accent={c.ink}
      />
    </MobileFrame>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 32,
        marginBottom: 4,
        fontSize: 9,
        letterSpacing: '0.4em',
        textTransform: 'uppercase',
        color: '#666666',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
      }}
    >
      {children}
    </div>
  );
}
