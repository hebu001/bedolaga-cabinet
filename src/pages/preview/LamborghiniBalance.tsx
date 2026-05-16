import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  gold: '#FFC000',
  goldText: '#FFCE3E',
  goldDark: '#917300',
  canvas: '#000000',
  charcoal: '#202020',
  iron: '#181818',
  ink: '#ffffff',
  smoke: '#f5f5f5',
  ash: '#7d7d7d',
  hairline: '#2a2a2a',
};

const font =
  '"Helvetica Neue", Arial, system-ui, -apple-system, sans-serif';

const methods = [
  { name: 'БАНКОВСКАЯ КАРТА', sub: 'Visa · MC · МИР' },
  { name: 'КРИПТОВАЛЮТА', sub: 'USDT · BTC · TON' },
  { name: 'TELEGRAM STARS', sub: 'Через бота' },
];

const txs = [
  { date: '12 МАЯ', desc: 'Пополнение · Карта', amount: '+₽1 000', positive: true },
  { date: '08 МАЯ', desc: 'Premium · продление', amount: '−₽290', positive: false },
  { date: '03 МАЯ', desc: 'Промокод BEDOLAGA10', amount: '+₽50', positive: true },
  { date: '28 АПР', desc: 'Пополнение · USDT', amount: '+₽2 500', positive: true },
];

export default function LamborghiniBalance() {
  return (
    <MobileFrame label="Lamborghini · Balance" bg={c.canvas} fg={c.ink}>
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
          Account
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
          Баланс
        </h1>

        <div
          style={{
            marginTop: 20,
            background: c.charcoal,
            border: `1px solid ${c.hairline}`,
            padding: 24,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: c.ash,
            }}
          >
            Доступно
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: '0.01em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            ₽2 450
            <span style={{ color: c.ash, fontWeight: 400 }}>,00</span>
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              letterSpacing: '0.1em',
              color: c.goldText,
              textTransform: 'uppercase',
            }}
          >
            ▲ +₽180 · неделя
          </div>
          <div style={{ display: 'flex', gap: 1, marginTop: 22 }}>
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
              Пополнить
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
              Промокод
            </button>
          </div>
        </div>

        <SectionTitle>Способы оплаты</SectionTitle>
        <div style={{ display: 'grid', gap: 1, background: c.hairline }}>
          {methods.map((m) => (
            <div
              key={m.name}
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
                  {m.name}
                </div>
                <div style={{ fontSize: 11, color: c.ash, marginTop: 4 }}>
                  {m.sub}
                </div>
              </div>
              <span style={{ color: c.gold, fontSize: 16 }}>→</span>
            </div>
          ))}
        </div>

        <SectionTitle>История</SectionTitle>
        <div style={{ display: 'grid', gap: 1, background: c.hairline }}>
          {txs.map((t, i) => (
            <div
              key={i}
              style={{
                background: c.iron,
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13 }}>{t.desc}</div>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.16em',
                    color: c.ash,
                    marginTop: 4,
                  }}
                >
                  {t.date}
                </div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: t.positive ? c.goldText : c.ink,
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
