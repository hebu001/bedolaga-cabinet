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
};

const font =
  '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

const methods = [
  { name: 'Банковская карта', sub: 'Visa, Mastercard, МИР' },
  { name: 'Криптовалюта', sub: 'USDT, BTC, TON' },
  { name: 'Telegram Stars', sub: 'Через бота' },
];

const txs = [
  { date: '12 мая', desc: 'Пополнение · Карта', amount: '+₽1 000', positive: true },
  { date: '8 мая', desc: 'Premium · продление', amount: '−₽290', positive: false },
  { date: '3 мая', desc: 'Промокод BEDOLAGA10', amount: '+₽50', positive: true },
  { date: '28 апр', desc: 'Пополнение · USDT', amount: '+₽2 500', positive: true },
];

export default function AppleBalance() {
  return (
    <MobileFrame label="Apple · Balance" bg={c.canvas} fg={c.ink} navTint="#98989d">
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
          Баланс
        </h1>

        <div
          style={{
            marginTop: 18,
            background: c.card,
            borderRadius: 20,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, color: c.inkMute }}>Доступно</div>
          <div
            style={{
              marginTop: 8,
              fontSize: 52,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.05,
            }}
          >
            ₽2 450
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 14,
              color: c.green,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ↑ ₽180 за неделю
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
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
              Пополнить
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
              Промокод
            </button>
          </div>
        </div>

        <SectionTitle>Способы оплаты</SectionTitle>
        <div
          style={{
            background: c.card,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {methods.map((m, i) => (
            <div
              key={m.name}
              style={{
                padding: '13px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                borderBottom:
                  i === methods.length - 1 ? 'none' : `1px solid ${c.divider}`,
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: c.elevated,
                  display: 'grid',
                  placeItems: 'center',
                  color: c.primary,
                  fontSize: 16,
                }}
              >
                ◉
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: c.inkMute, marginTop: 1 }}>
                  {m.sub}
                </div>
              </div>
              <span style={{ color: '#5a5a5e', fontSize: 18 }}>›</span>
            </div>
          ))}
        </div>

        <SectionTitle>История</SectionTitle>
        <div
          style={{
            background: c.card,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {txs.map((t, i) => (
            <div
              key={i}
              style={{
                padding: '13px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom:
                  i === txs.length - 1 ? 'none' : `1px solid ${c.divider}`,
              }}
            >
              <div>
                <div style={{ fontSize: 15 }}>{t.desc}</div>
                <div style={{ fontSize: 13, color: c.inkMute, marginTop: 1 }}>
                  {t.date}
                </div>
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: t.positive ? c.green : c.ink,
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
