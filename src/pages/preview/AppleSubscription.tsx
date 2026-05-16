import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#0a84ff',
  ink: '#f5f5f7',
  inkMute: '#98989d',
  canvas: '#000000',
  card: '#1c1c1e',
  elevated: '#2c2c2e',
  divider: 'rgba(255,255,255,0.08)',
  green: '#30d158',
  amber: '#ff9f0a',
  red: '#ff453a',
};

const font =
  '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

const servers = [
  { country: 'Нидерланды', city: 'Амстердам', ping: 24 },
  { country: 'Германия', city: 'Франкфурт', ping: 38 },
  { country: 'США', city: 'Нью-Йорк', ping: 120 },
];

export default function AppleSubscription() {
  return (
    <MobileFrame label="Apple · Subscription" bg={c.canvas} fg={c.ink} navTint="#98989d">
      <div style={{ padding: '8px 20px 0', fontFamily: font }}>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: 0,
            padding: '14px 2px 2px',
          }}
        >
          Подписка
        </h1>

        <div
          style={{
            position: 'relative',
            marginTop: 18,
            background: c.card,
            borderRadius: 20,
            padding: 24,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -70,
              right: -50,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(10,132,255,0.32) 0%, transparent 70%)',
              filter: 'blur(24px)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 14, color: c.inkMute }}>
                Текущий план
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: c.green,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: c.green,
                  }}
                />
                Активна
              </span>
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}
            >
              Premium
            </div>
            <div
              style={{
                fontSize: 14,
                color: c.inkMute,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ₽290 в месяц · продление 28 мая
            </div>

            <div style={{ marginTop: 22, display: 'grid', gap: 16 }}>
              <Meter label="Трафик" value="42,1 из 100 ГБ" pct={42.1} />
              <Meter label="Устройства" value="3 из 10" pct={30} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            style={{
              flex: 1,
              background: c.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 980,
              padding: '13px',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: font,
            }}
          >
            Продлить
          </button>
          <button
            style={{
              flex: 1,
              background: c.elevated,
              color: c.primary,
              border: 'none',
              borderRadius: 980,
              padding: '13px',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: font,
            }}
          >
            Сменить план
          </button>
        </div>

        <SectionTitle>Серверы</SectionTitle>
        <div
          style={{
            background: c.card,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {servers.map((s, i) => (
            <div
              key={s.country}
              style={{
                padding: '13px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom:
                  i === servers.length - 1 ? 'none' : `1px solid ${c.divider}`,
              }}
            >
              <div>
                <div style={{ fontSize: 15 }}>{s.country}</div>
                <div style={{ fontSize: 13, color: c.inkMute, marginTop: 1 }}>
                  {s.city}
                </div>
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  color:
                    s.ping < 50 ? c.green : s.ping < 100 ? c.amber : c.red,
                }}
              >
                {s.ping} мс
              </span>
            </div>
          ))}
        </div>

        <SectionTitle>Параметры</SectionTitle>
        <div
          style={{
            background: c.card,
            borderRadius: 16,
            padding: '4px 16px',
          }}
        >
          <Row label="Протокол" value="VLESS · Reality" />
          <Row label="Подключений" value="1 из 5" />
          <Row label="Автопродление" value="Включено" valueColor={c.primary} last />
        </div>
        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="subscription"
        links={{
          balance: '/preview/apple/balance',
          subscription: '/preview/apple/subscription',
        }}
        bg="rgba(0,0,0,0.92)"
        fgMute={c.inkMute}
        accent={c.primary}
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
          fontSize: 13,
          marginBottom: 7,
        }}
      >
        <span style={{ color: '#98989d' }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 9999,
          background: 'rgba(255,255,255,0.10)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 9999,
            background: '#0a84ff',
          }}
        />
      </div>
    </div>
  );
}

function Row({
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
        padding: '12px 0',
        fontSize: 15,
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span style={{ color: '#98989d' }}>{label}</span>
      <span style={{ color: valueColor ?? '#f5f5f7', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 22,
        marginBottom: 10,
        fontSize: 13,
        fontWeight: 600,
        color: '#98989d',
        padding: '0 6px',
      }}
    >
      {children}
    </div>
  );
}
