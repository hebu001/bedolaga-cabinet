import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  gold: '#FFC000',
  goldText: '#FFCE3E',
  canvas: '#000000',
  charcoal: '#202020',
  iron: '#181818',
  ink: '#ffffff',
  ash: '#7d7d7d',
  hairline: '#2a2a2a',
};

const font = '"Helvetica Neue", Arial, system-ui, -apple-system, sans-serif';

const servers = [
  { country: 'НИДЕРЛАНДЫ', city: 'Амстердам', ping: 24 },
  { country: 'ГЕРМАНИЯ', city: 'Франкфурт', ping: 38 },
  { country: 'США', city: 'Нью-Йорк', ping: 120 },
];

export default function LamborghiniSubscription() {
  return (
    <MobileFrame label="Lamborghini · Subscription" bg={c.canvas} fg={c.ink}>
      <div style={{ padding: '8px 18px 0', fontFamily: font }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: c.gold,
            padding: '8px 2px 4px',
          }}
        >
          Subscription
        </div>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            margin: 0,
            lineHeight: 1,
          }}
        >
          Premium
        </h1>

        <div
          style={{
            marginTop: 20,
            background: c.charcoal,
            border: `1px solid ${c.gold}`,
            padding: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: c.ash,
              }}
            >
              Текущий план
            </span>
            <span
              style={{
                fontSize: 9,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#000',
                background: c.gold,
                padding: '4px 9px',
              }}
            >
              Active
            </span>
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Premium
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              letterSpacing: '0.1em',
              color: c.ash,
              textTransform: 'uppercase',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ₽290 / мес · до 28 мая
          </div>

          <div style={{ marginTop: 22, display: 'grid', gap: 16 }}>
            <Meter label="Трафик" value="42.1 / 100 GB" pct={42.1} />
            <Meter label="Устройства" value="3 / 10" pct={30} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 1, marginTop: 18 }}>
          <button
            style={{
              flex: 1,
              background: c.gold,
              color: '#000',
              border: 'none',
              borderRadius: 0,
              padding: '15px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
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
              border: `1px solid ${c.ink}`,
              borderRadius: 0,
              padding: '15px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: font,
            }}
          >
            Сменить
          </button>
        </div>

        <SectionTitle>Серверы · 3</SectionTitle>
        <div style={{ display: 'grid', gap: 1, background: c.hairline }}>
          {servers.map((s) => (
            <div
              key={s.country}
              style={{
                background: c.iron,
                padding: '16px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                  }}
                >
                  {s.country}
                </div>
                <div style={{ fontSize: 11, color: c.ash, marginTop: 4 }}>{s.city}</div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: s.ping < 50 ? c.goldText : s.ping < 100 ? c.ink : c.ash,
                }}
              >
                {s.ping} MS
              </span>
            </div>
          ))}
        </div>

        <SectionTitle>Конфигурация</SectionTitle>
        <div style={{ background: c.iron, padding: '4px 18px' }}>
          <Row label="Протокол" value="VLESS · REALITY" />
          <Row label="Подключений" value="1 / 5" />
          <Row label="Авто-продление" value="ВКЛ" gold last />
        </div>
        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="subscription"
        links={{
          balance: '/preview/lamborghini/balance',
          subscription: '/preview/lamborghini/subscription',
        }}
        bg="rgba(0,0,0,0.95)"
        fgMute={c.ash}
        accent={c.gold}
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
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        <span style={{ color: c.ash }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div style={{ height: 3, background: '#000', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: c.gold }} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  gold,
  last,
}: {
  label: string;
  value: string;
  gold?: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '13px 0',
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        borderBottom: last ? 'none' : `1px solid ${c.hairline}`,
      }}
    >
      <span style={{ color: c.ash }}>{label}</span>
      <span style={{ color: gold ? c.gold : c.ink, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 24,
        marginBottom: 12,
        fontSize: 10,
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: '#FFC000',
        padding: '0 2px',
      }}
    >
      {children}
    </div>
  );
}
