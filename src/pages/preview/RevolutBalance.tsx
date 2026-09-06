import { MobileFrame, MobileTabBar } from './MobileFrame';

const c = {
  primary: '#4f55f1',
  surface: '#16181a',
  surfaceSoft: '#1a1c1f',
  hairline: 'rgba(255,255,255,0.06)',
  ink: '#ffffff',
  inkMute: 'rgba(255,255,255,0.72)',
  faint: '#8d969e',
};

const transactions = [
  { date: 'Сегодня · 12:08', desc: 'Top up · Card', amount: '+₽1 000', positive: true, icon: '↓' },
  { date: '08 мая', desc: 'Premium · renewal', amount: '−₽290', positive: false, icon: '↑' },
  { date: '03 мая', desc: 'Promo BEDOLAGA10', amount: '+₽50', positive: true, icon: '%' },
  { date: '28 апр', desc: 'Top up · USDT', amount: '+₽2 500', positive: true, icon: '↓' },
];

export default function RevolutBalance() {
  return (
    <MobileFrame label="Revolut · Balance" bg="#000000" fg={c.ink}>
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
          Кошелёк
        </h1>

        <div
          style={{
            position: 'relative',
            marginTop: 16,
            borderRadius: 22,
            padding: 24,
            overflow: 'hidden',
            background:
              'radial-gradient(circle at 100% 0%, #2a2eaf 0%, transparent 60%), ' +
              'linear-gradient(135deg, #0a0a0a 0%, #16181a 60%, #1f1f30 100%)',
            border: '1px solid rgba(79,85,241,0.18)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -50,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(79,85,241,0.55) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 12, color: c.inkMute }}>Доступно</div>
            <div
              style={{
                marginTop: 8,
                fontSize: 44,
                fontWeight: 600,
                letterSpacing: '-0.04em',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              ₽ 2 450
              <span style={{ color: '#c9c9cd', fontWeight: 500 }}>,00</span>
            </div>
            <div
              style={{
                marginTop: 10,
                display: 'inline-flex',
                gap: 6,
                background: 'rgba(34,197,94,0.14)',
                border: '1px solid rgba(34,197,94,0.32)',
                color: '#86efac',
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 9999,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ↗ +₽180 за неделю
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}
        >
          {[
            { icon: '+', label: 'Top up' },
            { icon: '%', label: 'Promo' },
            { icon: '★', label: 'Stars' },
            { icon: '↻', label: 'History' },
          ].map((a) => (
            <button
              key={a.label}
              style={{
                background: c.surface,
                border: `1px solid ${c.hairline}`,
                borderRadius: 14,
                padding: '12px 6px',
                color: c.ink,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'inherit',
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #4f55f1 0%, #7c3aed 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 14,
                }}
              >
                {a.icon}
              </span>
              {a.label}
            </button>
          ))}
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 13,
            fontWeight: 600,
            color: c.ink,
            padding: '0 4px',
          }}
        >
          Способы оплаты
        </div>
        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          {[
            { name: 'Карта', sub: '•••• 4242', accent: c.primary },
            { name: 'Crypto', sub: 'USDT, BTC, TON', accent: '#f59e0b' },
            { name: 'Stars', sub: 'Telegram', accent: '#ec4899' },
          ].map((m) => (
            <div
              key={m.name}
              style={{
                background: c.surface,
                border: `1px solid ${c.hairline}`,
                borderRadius: 14,
                padding: '14px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: m.accent,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                <div style={{ color: c.inkMute, fontSize: 12, marginTop: 2 }}>{m.sub}</div>
              </div>
              <span style={{ color: c.faint, fontSize: 18 }}>›</span>
            </div>
          ))}
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
          <span style={{ fontSize: 13, fontWeight: 600 }}>Транзакции</span>
          <span style={{ fontSize: 11, color: c.faint }}>За май</span>
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
          {transactions.map((tx, i) => (
            <div
              key={i}
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderBottom:
                  i === transactions.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: tx.positive ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.06)',
                  color: tx.positive ? '#22c55e' : '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {tx.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{tx.desc}</div>
                <div style={{ fontSize: 11, color: c.faint, marginTop: 2 }}>{tx.date}</div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: tx.positive ? '#22c55e' : '#fff',
                  whiteSpace: 'nowrap',
                }}
              >
                {tx.amount}
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 16 }} />
      </div>
      <MobileTabBar
        active="balance"
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
