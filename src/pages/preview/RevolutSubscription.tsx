import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#4f55f1',
  surface: '#16181a',
  hairline: 'rgba(255,255,255,0.06)',
  ink: '#ffffff',
  inkMute: 'rgba(255,255,255,0.72)',
  faint: '#8d969e',
};

const servers = [
  { country: 'Нидерланды', city: 'AMS', ping: 24, flag: '🇳🇱' },
  { country: 'Германия', city: 'FRA', ping: 38, flag: '🇩🇪' },
  { country: 'США', city: 'NYC', ping: 120, flag: '🇺🇸' },
];

export default function RevolutSubscription() {
  return (
    <MobileFrame label="Revolut · Subscription" bg="#000000" fg={c.ink}>
      <div style={{ padding: '4px 16px 0', fontFamily: 'Aeonik, Inter, system-ui, sans-serif' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.04em',
            margin: 0,
            padding: '12px 4px 0',
          }}
        >
          Подписка
        </h1>

        <div
          style={{
            position: 'relative',
            marginTop: 16,
            borderRadius: 22,
            padding: 24,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #16181a 0%, #1c1c2e 60%, #2a2eaf 100%)',
            border: '1px solid rgba(79,85,241,0.32)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(79,85,241,0.55) 0%, transparent 70%)',
              filter: 'blur(28px)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#86efac',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 8px #22c55e',
                }}
              />
              Active
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: '-0.04em',
              }}
            >
              Premium
            </div>
            <div style={{ marginTop: 4, color: c.inkMute, fontSize: 13 }}>
              100 GB · 10 устройств · до 28 мая
            </div>

            <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
              <Bar label="Трафик" used="42.1 GB" total="100 GB" pct={42.1} />
              <Bar label="Устройства" used="3" total="10" pct={30} />
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 14,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: 12, color: c.inkMute }}>Цена</span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ₽290<span style={{ color: c.faint, fontSize: 13 }}> / мес</span>
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #4f55f1 0%, #7c3aed 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: '14px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Продлить
          </button>
          <button
            style={{
              flex: 1,
              background: c.surface,
              color: c.ink,
              border: `1px solid ${c.hairline}`,
              borderRadius: 14,
              padding: '14px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Сменить план
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '0 4px',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>Серверы</span>
          <span style={{ fontSize: 11, color: c.faint }}>3 доступны</span>
        </div>
        <div
          style={{
            marginTop: 8,
            background: c.surface,
            border: `1px solid ${c.hairline}`,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {servers.map((s, i) => (
            <div
              key={s.country}
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderBottom:
                  i === servers.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span style={{ fontSize: 22 }}>{s.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.country}</div>
                <div style={{ fontSize: 11, color: c.faint, marginTop: 2 }}>{s.city}</div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: s.ping < 50 ? '#22c55e' : s.ping < 100 ? '#facc15' : '#f87171',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.ping} ms
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 18,
            background: c.surface,
            border: `1px solid ${c.hairline}`,
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Конфигурация</div>
          <KV label="Протокол" value="VLESS · Reality" />
          <KV label="Подключений" value="1 / 5" />
          <KV label="Авто-продление" value="Включено" valueColor="#86efac" />
        </div>

        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="subscription"
        links={{
          balance: '/preview/revolut/balance',
          subscription: '/preview/revolut/subscription',
        }}
        bg="rgba(10,10,10,0.92)"
        fgMute={c.faint}
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
        <span style={{ color: 'rgba(255,255,255,0.72)' }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontWeight: 600 }}>{used}</span>
          <span style={{ color: '#8d969e' }}> / {total}</span>
        </span>
      </div>
      <div
        style={{
          height: 5,
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
            background: 'linear-gradient(90deg, #4f55f1 0%, #7c3aed 100%)',
          }}
        />
      </div>
    </div>
  );
}

function KV({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        fontSize: 13,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.72)' }}>{label}</span>
      <span style={{ color: valueColor ?? '#fff', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
