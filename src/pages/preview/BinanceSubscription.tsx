import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#fcd535',
  canvas: '#0b0e11',
  card: '#1e2329',
  elevated: '#2b3139',
  body: '#eaecef',
  muted: '#707a8a',
  hairline: '#2b3139',
  up: '#0ecb81',
  down: '#f6465d',
};

const font =
  '"Binance Plex", "IBM Plex Sans", system-ui, -apple-system, Arial, sans-serif';

const servers = [
  { country: 'Netherlands', code: 'NL-AMS', ping: 24 },
  { country: 'Germany', code: 'DE-FRA', ping: 38 },
  { country: 'United States', code: 'US-NYC', ping: 120 },
];

export default function BinanceSubscription() {
  return (
    <MobileFrame label="Binance · Subscription" bg={c.canvas} fg={c.body}>
      <div style={{ padding: '6px 16px 0', fontFamily: font }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            margin: 0,
            padding: '10px 2px 6px',
          }}
        >
          Subscription
        </h1>

        <div
          style={{
            marginTop: 8,
            background: c.card,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background:
                'linear-gradient(135deg, #fcd535 0%, #f0b90b 100%)',
              padding: '16px 18px',
              color: '#181a20',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>
                CURRENT PLAN
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: '#181a20',
                  color: c.primary,
                  borderRadius: 4,
                  padding: '3px 8px',
                }}
              >
                ● ACTIVE
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 700 }}>
              Premium
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                opacity: 0.75,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ₽290 / month · renews 2026-05-28
            </div>
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
            <Bar label="Traffic" used="42.1" total="100 GB" pct={42.1} />
            <Bar label="Devices" used="3" total="10" pct={30} />
            <Bar label="Connections" used="1" total="5" pct={20} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
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
            Renew
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
            Upgrade
          </button>
        </div>

        <SectionTitle>Server Nodes</SectionTitle>
        <div
          style={{
            background: c.card,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '9px 14px',
              display: 'grid',
              gridTemplateColumns: '1fr 80px 64px',
              gap: 8,
              fontSize: 10,
              color: c.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderBottom: `1px solid ${c.hairline}`,
            }}
          >
            <span>Country</span>
            <span>Node</span>
            <span style={{ textAlign: 'right' }}>Ping</span>
          </div>
          {servers.map((s, i) => (
            <div
              key={s.country}
              style={{
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr 80px 64px',
                gap: 8,
                alignItems: 'center',
                fontSize: 13,
                borderBottom:
                  i === servers.length - 1 ? 'none' : `1px solid ${c.hairline}`,
              }}
            >
              <span>{s.country}</span>
              <span style={{ color: c.muted, fontSize: 12 }}>{s.code}</span>
              <span
                style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: s.ping < 50 ? c.up : s.ping < 100 ? c.primary : c.down,
                }}
              >
                {s.ping}ms
              </span>
            </div>
          ))}
        </div>

        <SectionTitle>Plan Details</SectionTitle>
        <div style={{ background: c.card, borderRadius: 8, padding: '4px 14px' }}>
          <KV label="Protocol" value="VLESS · Reality" />
          <KV label="Auto-renew" value="Enabled" valueColor={c.up} />
          <KV label="Next charge" value="₽290 · 28 May" last />
        </div>
        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="subscription"
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

function Bar({
  label,
  used,
  total,
  pct,
}: {
  label: string;
  used: string;
  total: string;
  pct: number;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          marginBottom: 6,
        }}
      >
        <span style={{ color: '#707a8a' }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontWeight: 600 }}>{used}</span>
          <span style={{ color: '#707a8a' }}> / {total}</span>
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: '#2b3139',
          borderRadius: 9999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: '#fcd535',
            borderRadius: 9999,
          }}
        />
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  valueColor,
  last,
}: {
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '11px 0',
        fontSize: 13,
        borderBottom: last ? 'none' : '1px solid #2b3139',
      }}
    >
      <span style={{ color: '#707a8a' }}>{label}</span>
      <span
        style={{
          color: valueColor ?? '#eaecef',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
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
