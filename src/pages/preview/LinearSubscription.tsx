import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#5e6ad2',
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

const usage = [
  { name: 'Traffic', used: 42.1, total: 100, unit: 'GB', pct: 42.1 },
  { name: 'Devices', used: 3, total: 10, unit: '', pct: 30 },
  { name: 'Active connections', used: 1, total: 5, unit: '', pct: 20 },
];

const servers = [
  { country: 'Netherlands', code: 'NL · AMS', ping: 24 },
  { country: 'Germany', code: 'DE · FRA', ping: 38 },
  { country: 'United States', code: 'US · NYC', ping: 120 },
];

export default function LinearSubscription() {
  return (
    <MobileFrame label="Linear · Subscription" bg={c.canvas} fg={c.ink}>
      <div
        style={{
          padding: '4px 16px 0',
          fontFamily: '"Inter Display", "Inter", system-ui, sans-serif',
        }}
      >
        <div style={{ padding: '8px 4px 6px' }}>
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
            Subscription
          </h1>
        </div>

        <div
          style={{
            marginTop: 8,
            background: c.surface1,
            border: `1px solid ${c.hairline}`,
            borderRadius: 10,
            padding: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
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
              Plan
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#86efac',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22c55e',
                }}
              />
              Active
            </span>
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Premium
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'grid',
              gap: 6,
              fontSize: 13,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <KV label="Renews" value="May 28, 2026" />
            <KV label="Cost" value="₽290 / month" />
            <KV label="Provisioning" value="Auto" highlight />
          </div>
        </div>

        <SectionLabel>Usage</SectionLabel>
        <div
          style={{
            background: c.surface1,
            border: `1px solid ${c.hairline}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {usage.map((u, i) => (
            <div
              key={u.name}
              style={{
                padding: '12px 14px',
                borderBottom:
                  i === usage.length - 1 ? 'none' : `1px solid ${c.hairline}`,
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span>{u.name}</span>
                <span style={{ color: c.inkSubtle }}>
                  {u.used} / {u.total} {u.unit}{' '}
                  <span style={{ marginLeft: 8, color: c.inkTertiary }}>
                    {u.pct.toFixed(0)}%
                  </span>
                </span>
              </div>
              <div
                style={{
                  height: 3,
                  background: c.surface3,
                  borderRadius: 9999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${u.pct}%`,
                    height: '100%',
                    background: c.primary,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <SectionLabel>Servers · 3 active</SectionLabel>
        <div
          style={{
            background: c.surface1,
            border: `1px solid ${c.hairline}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {servers.map((s, i) => (
            <div
              key={s.country}
              style={{
                padding: '12px 14px',
                borderBottom:
                  i === servers.length - 1 ? 'none' : `1px solid ${c.hairline}`,
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <div>
                <div>{s.country}</div>
                <div
                  style={{
                    color: c.inkSubtle,
                    fontSize: 11,
                    marginTop: 2,
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  }}
                >
                  {s.code}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontVariantNumeric: 'tabular-nums',
                  color:
                    s.ping < 50 ? '#86efac' : s.ping < 100 ? '#facc15' : '#f87171',
                }}
              >
                {s.ping}ms
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
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
            Renew now
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
            Change plan
          </button>
        </div>

        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="subscription"
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

function KV({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: c.inkSubtle }}>{label}</span>
      <span style={{ color: highlight ? c.primary : c.ink, fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}
