import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#533afd',
  ink: '#0d253d',
  inkMute: '#64748d',
  canvas: '#ffffff',
  hairline: '#e3e8ee',
};

const mesh =
  'radial-gradient(circle at 0% 0%, #c2c0ff 0%, transparent 50%), ' +
  'radial-gradient(circle at 100% 0%, #ffd4f1 0%, transparent 45%), ' +
  'radial-gradient(circle at 50% 100%, #b6e3ff 0%, transparent 50%), #f6f9fc';

const font =
  '"Sohne", "SF Pro Display", system-ui, -apple-system, Inter, sans-serif';

const servers = [
  { country: 'Нидерланды', city: 'Амстердам', ping: '24 ms', flag: '🇳🇱' },
  { country: 'Германия', city: 'Франкфурт', ping: '38 ms', flag: '🇩🇪' },
  { country: 'США', city: 'Нью-Йорк', ping: '120 ms', flag: '🇺🇸' },
];

export default function StripeSubscription() {
  return (
    <MobileFrame label="Stripe · Subscription" bg={mesh} fg={c.ink} navTint="#d6d8eb">
      <div
        style={{
          padding: '12px 20px 0',
          color: c.ink,
          fontFamily: font,
          fontWeight: 300,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: c.inkMute,
            marginBottom: 8,
          }}
        >
          Account · Подписка
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 300,
            letterSpacing: '-0.6px',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Premium
        </h1>

        <div
          style={{
            marginTop: 18,
            position: 'relative',
            background:
              'linear-gradient(135deg, #2e2b8c 0%, #533afd 50%, #f96bee 100%)',
            color: '#fff',
            borderRadius: 18,
            padding: 22,
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(83,58,253,0.32)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8 }}>Текущий план</div>
            <span
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.32)',
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: 9999,
              }}
            >
              ● Active
            </span>
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 28,
              fontWeight: 300,
              letterSpacing: '-0.5px',
            }}
          >
            Premium / месяц
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              opacity: 0.82,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ₽290 · продление 28 мая
          </div>

          <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
            <Meter label="Трафик" value="42.1 / 100 GB" pct={42.1} />
            <Meter label="Устройства" value="3 / 10" pct={30} />
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            display: 'flex',
            gap: 8,
          }}
        >
          <button
            style={{
              flex: 1,
              background: c.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 9999,
              padding: '12px 14px',
              fontSize: 14,
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
              background: 'transparent',
              color: c.ink,
              border: `1px solid ${c.hairline}`,
              borderRadius: 9999,
              padding: '12px 14px',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: font,
            }}
          >
            Поделиться
          </button>
        </div>

        <div
          style={{
            marginTop: 22,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500 }}>Серверы</div>
          <span style={{ fontSize: 11, color: c.inkMute }}>3 активны</span>
        </div>
        <div
          style={{
            marginTop: 10,
            background: c.canvas,
            border: `1px solid ${c.hairline}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {servers.map((s, i) => (
            <div
              key={s.country}
              style={{
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderBottom:
                  i === servers.length - 1 ? 'none' : `1px solid ${c.hairline}`,
              }}
            >
              <span style={{ fontSize: 22 }}>{s.flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>{s.country}</div>
                <div style={{ fontSize: 12, color: c.inkMute, marginTop: 2 }}>
                  {s.city}
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontVariantNumeric: 'tabular-nums',
                  color: c.inkMute,
                }}
              >
                {s.ping}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 18,
            background: c.canvas,
            border: `1px solid ${c.hairline}`,
            borderRadius: 14,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
            Конфигурация
          </div>
          <Row label="Протокол" value="VLESS · Reality" />
          <Row label="Подключений" value="1 из 5" />
          <Row label="Авто-продление" value="Включено" valueColor={c.primary} />
        </div>

        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="subscription"
        links={{
          balance: '/preview/stripe/balance',
          subscription: '/preview/stripe/subscription',
        }}
        bg="rgba(255,255,255,0.85)"
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
          fontSize: 12,
          marginBottom: 6,
        }}
      >
        <span style={{ opacity: 0.85 }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 9999,
          background: 'rgba(255,255,255,0.22)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: '#ffffff',
            borderRadius: 9999,
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
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        fontSize: 13,
        borderBottom: '1px solid rgba(0,0,0,0.04)',
      }}
    >
      <span style={{ color: c.inkMute }}>{label}</span>
      <span style={{ color: valueColor ?? c.ink, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
