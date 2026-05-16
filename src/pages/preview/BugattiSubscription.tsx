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
  surfaceCard: '#141414',
};

const font = '"Bugatti", "Times New Roman", Georgia, serif';
const sans = '"Helvetica Neue", Arial, sans-serif';

const servers = [
  { country: 'Netherlands', city: 'Amsterdam', ping: 24 },
  { country: 'Germany', city: 'Frankfurt', ping: 38 },
  { country: 'United States', city: 'New York', ping: 120 },
];

export default function BugattiSubscription() {
  return (
    <MobileFrame label="Bugatti · Subscription" bg={c.canvas} fg={c.ink}>
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
          Subscription
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
          Premium
        </h1>
        <div style={{ marginTop: 6, height: 1, background: c.hairlineStrong }} />

        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              fontSize: 9,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: c.ink,
              border: `1px solid ${c.hairlineStrong}`,
              padding: '6px 14px',
              fontFamily: sans,
            }}
          >
            ✦ Active
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 30,
              fontWeight: 300,
              letterSpacing: '0.02em',
              fontFamily: font,
            }}
          >
            Premium Plan
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: c.muted,
              fontFamily: sans,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ₽290 / month · until 28 may
          </div>
        </div>

        <div style={{ marginTop: 28, display: 'grid', gap: 20 }}>
          <Meter label="Traffic" value="42.1 / 100 GB" pct={42.1} />
          <Meter label="Devices" value="3 / 10" pct={30} />
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
            Renew
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
            Change plan
          </button>
        </div>

        <SectionTitle>Servers · 3</SectionTitle>
        {servers.map((s, i) => (
          <div
            key={s.country}
            style={{
              padding: '18px 2px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: `1px solid ${c.hairline}`,
              borderBottom:
                i === servers.length - 1 ? `1px solid ${c.hairline}` : 'none',
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 300, fontFamily: font }}>
                {s.country}
              </div>
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
                {s.city}
              </div>
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 300,
                fontFamily: font,
                fontVariantNumeric: 'tabular-nums',
                color: s.ping < 100 ? c.bodyStrong : c.mutedSoft,
              }}
            >
              {s.ping} ms
            </span>
          </div>
        ))}

        <SectionTitle>Configuration</SectionTitle>
        <Row label="Protocol" value="VLESS · Reality" />
        <Row label="Connections" value="1 / 5" />
        <Row label="Auto-renew" value="Enabled" last />
        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="subscription"
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

function Meter({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: 10,
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
        }}
      >
        <span style={{ color: '#666666' }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#e6e6e6' }}>
          {value}
        </span>
      </div>
      <div style={{ height: 1, background: '#262626' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#ffffff' }} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '15px 2px',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        borderTop: '1px solid #262626',
        borderBottom: last ? '1px solid #262626' : 'none',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
      }}
    >
      <span style={{ color: '#666666' }}>{label}</span>
      <span style={{ color: '#e6e6e6' }}>{value}</span>
    </div>
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
