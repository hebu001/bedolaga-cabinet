import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#3ecf8e',
  primarySoft: '#4ade80',
  primaryDeep: '#24b47e',
  canvasNight: '#1c1c1c',
  canvasNightSoft: '#202020',
  surface: '#262626',
  ink: '#ededed',
  inkMute: '#a1a1a1',
  inkFaint: '#707070',
  hairline: '#2f2f2f',
};

const mono =
  '"Berkeley Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace';

const servers = [
  { country: 'netherlands', code: 'NL.AMS', ping: 24 },
  { country: 'germany', code: 'DE.FRA', ping: 38 },
  { country: 'united_states', code: 'US.NYC', ping: 120 },
];

export default function SupabaseSubscription() {
  return (
    <MobileFrame label="Supabase · Subscription" bg={c.canvasNight} fg={c.ink}>
      <div
        style={{
          padding: '4px 14px 0',
          fontFamily:
            '"Custom Inter", "Inter", system-ui, -apple-system, sans-serif',
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
            // billing.subscription
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
            # subscription
          </h1>
        </div>

        <Panel title="subscription.state" badge="ACTIVE">
          <div
            style={{
              fontFamily: mono,
              fontSize: 12,
              color: c.inkMute,
              display: 'grid',
              gap: 5,
            }}
          >
            <KV k="plan" v={`"premium"`} vColor={c.primarySoft} />
            <KV k="status" v={`"active"`} vColor={c.primarySoft} />
            <KV k="renews_at" v={`"2026-05-28"`} vColor="#fbbf24" />
            <KV k="price" v="290" suffix=" RUB / month" />
            <KV k="autorenew" v="true" vColor={c.primarySoft} />
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
              $ renew
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
              $ change-plan
            </button>
          </div>
        </Panel>

        <Panel title="usage">
          <Bar label="traffic" used="42.1" total="100" unit="GB" pct={42.1} />
          <div style={{ height: 12 }} />
          <Bar label="devices" used="3" total="10" unit="" pct={30} />
          <div style={{ height: 12 }} />
          <Bar label="connections" used="1" total="5" unit="" pct={20} />
        </Panel>

        <Panel title="servers" badge="3">
          <div
            style={{
              fontFamily: mono,
              fontSize: 10,
              color: c.inkFaint,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'grid',
              gridTemplateColumns: '1fr 80px 60px',
              gap: 8,
              paddingBottom: 6,
              borderBottom: `1px solid ${c.hairline}`,
            }}
          >
            <span>country</span>
            <span>node</span>
            <span style={{ textAlign: 'right' }}>ping</span>
          </div>
          {servers.map((s, i) => (
            <div
              key={s.country}
              style={{
                fontFamily: mono,
                fontSize: 12,
                display: 'grid',
                gridTemplateColumns: '1fr 80px 60px',
                gap: 8,
                padding: '8px 0',
                borderBottom:
                  i === servers.length - 1 ? 'none' : `1px solid ${c.hairline}`,
                color: c.ink,
              }}
            >
              <span>{s.country}</span>
              <span style={{ color: c.inkMute }}>{s.code}</span>
              <span
                style={{
                  textAlign: 'right',
                  color:
                    s.ping < 50 ? c.primary : s.ping < 100 ? '#fbbf24' : '#f87171',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.ping}ms
              </span>
            </div>
          ))}
        </Panel>

        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="subscription"
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

function KV({
  k,
  v,
  suffix,
  vColor,
}: {
  k: string;
  v: string;
  suffix?: string;
  vColor?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: c.inkFaint }}>{k}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: vColor ?? c.ink }}>{v}</span>
        {suffix && <span style={{ color: c.inkFaint }}>{suffix}</span>}
      </span>
    </div>
  );
}

function Bar({
  label,
  used,
  total,
  unit,
  pct,
}: {
  label: string;
  used: string;
  total: string;
  unit: string;
  pct: number;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: mono,
          fontSize: 11,
          marginBottom: 5,
        }}
      >
        <span style={{ color: c.inkFaint }}>{label}</span>
        <span
          style={{ color: c.inkMute, fontVariantNumeric: 'tabular-nums' }}
        >
          {used} / {total} {unit} ·{' '}
          <span style={{ color: c.primary }}>{pct.toFixed(0)}%</span>
        </span>
      </div>
      <div
        style={{
          height: 3,
          background: c.surface,
          borderRadius: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: c.primary,
          }}
        />
      </div>
    </div>
  );
}
