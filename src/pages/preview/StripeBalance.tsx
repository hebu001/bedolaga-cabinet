import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#533afd',
  ink: '#0d253d',
  inkMute: '#64748d',
  canvas: '#ffffff',
  canvasSoft: '#f6f9fc',
  hairline: '#e3e8ee',
};

const mesh =
  'radial-gradient(circle at 0% 0%, #c2c0ff 0%, transparent 50%), ' +
  'radial-gradient(circle at 100% 0%, #ffd4f1 0%, transparent 45%), ' +
  'radial-gradient(circle at 50% 100%, #b6e3ff 0%, transparent 50%), #f6f9fc';

const font = '"Sohne", "SF Pro Display", system-ui, -apple-system, Inter, sans-serif';

const methods = [
  { name: 'Банковская карта', sub: 'Visa, MC, МИР', accent: c.primary },
  { name: 'Криптовалюта', sub: 'USDT, BTC, TON', accent: '#9b6829' },
  { name: 'Telegram Stars', sub: 'Через бота', accent: '#ea2261' },
];

const transactions = [
  { date: '12 мая', desc: 'Пополнение · Карта', amount: '+₽1,000', positive: true },
  { date: '08 мая', desc: 'Premium · продление', amount: '−₽290', positive: false },
  { date: '03 мая', desc: 'Промокод BEDOLAGA10', amount: '+₽50', positive: true },
  { date: '28 апр', desc: 'Пополнение · USDT', amount: '+₽2,500', positive: true },
];

export default function StripeBalance() {
  return (
    <MobileFrame label="Stripe · Balance" bg={mesh} fg={c.ink} navTint="#d6d8eb">
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
          Account · Финансы
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
          Баланс
        </h1>

        <div
          style={{
            marginTop: 18,
            background: c.canvas,
            border: `1px solid ${c.hairline}`,
            borderRadius: 16,
            padding: 22,
            boxShadow: '0 12px 32px rgba(13,37,61,0.06)',
          }}
        >
          <div style={{ fontSize: 12, color: c.inkMute }}>Доступно</div>
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ fontSize: 44, fontWeight: 300, letterSpacing: '-1.2px' }}>
              ₽&thinsp;2,450
            </span>
            <span style={{ fontSize: 22, fontWeight: 300, color: c.inkMute }}>.00</span>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: '#16a34a',
              display: 'flex',
              gap: 6,
            }}
          >
            <span>▲ ₽180</span>
            <span style={{ color: c.inkMute }}>за неделю</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
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
              Пополнить
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
              Промокод
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 13,
            fontWeight: 500,
            color: c.ink,
            letterSpacing: '-0.01em',
          }}
        >
          Способы оплаты
        </div>
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {methods.map((m) => (
            <div
              key={m.name}
              style={{
                background: c.canvas,
                border: `1px solid ${c.hairline}`,
                borderRadius: 14,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: m.accent,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: c.inkMute, marginTop: 2 }}>{m.sub}</div>
              </div>
              <div style={{ color: c.inkMute, fontSize: 18 }}>›</div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500 }}>История</div>
          <button
            style={{
              fontSize: 12,
              color: c.primary,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: font,
            }}
          >
            Все →
          </button>
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
          {transactions.map((t, i) => (
            <div
              key={i}
              style={{
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: i === transactions.length - 1 ? 'none' : `1px solid ${c.hairline}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{t.desc}</div>
                <div style={{ fontSize: 11, color: c.inkMute, marginTop: 2 }}>{t.date}</div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 500,
                  color: t.positive ? '#16a34a' : c.ink,
                  whiteSpace: 'nowrap',
                  marginLeft: 12,
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
        links={{ balance: '/preview/stripe/balance', subscription: '/preview/stripe/subscription' }}
        bg="rgba(255,255,255,0.85)"
        fgMute={c.inkMute}
        accent={c.primary}
      />
    </MobileFrame>
  );
}
