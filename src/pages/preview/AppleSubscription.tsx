import { useState, useEffect } from 'react';
import { MobileFrame, MobileTabBar } from './MobileFrame';

/**
 * Full redesigned Subscription layout — Apple-dark prototype.
 * Static mock data; mirrors every section of the real /subscription page so
 * the new layout can be reviewed before porting onto Subscription.tsx.
 */

const c = {
  primary: '#0a84ff',
  ink: '#f5f5f7',
  mute: '#98989d',
  faint: '#5a5a5e',
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

// expiry ~12 days out
const EXPIRY = Date.now() + 12 * 86_400_000 + 5 * 3_600_000 + 42 * 60_000;

function useCountdown(target: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

const devices = [
  { name: 'iPhone 15 Pro', meta: 'iOS · последний вход сегодня', icon: '□' },
  { name: 'MacBook Air', meta: 'macOS · 2 дня назад', icon: '□' },
  { name: 'iPad Air', meta: 'iPadOS · 5 дней назад', icon: '□' },
];

const servers = [
  { country: 'Нидерланды', city: 'Амстердам', ping: 24 },
  { country: 'Германия', city: 'Франкфурт', ping: 38 },
  { country: 'США', city: 'Нью-Йорк', ping: 120 },
];

export default function AppleSubscription() {
  const cd = useCountdown(EXPIRY);
  const [autopay, setAutopay] = useState(true);
  const [copied, setCopied] = useState(false);

  const trafficPct = 42.1;
  const devicePct = 30;

  return (
    <MobileFrame label="Apple · Subscription" bg={c.canvas} fg={c.ink} navTint="#98989d">
      <div style={{ padding: '8px 16px 0', fontFamily: font }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: 0,
            padding: '12px 4px 2px',
          }}
        >
          Подписка
        </h1>

        {/* ─── Hero status card ─── */}
        <div
          style={{
            position: 'relative',
            marginTop: 14,
            background: c.card,
            borderRadius: 22,
            padding: 22,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -80,
              right: -50,
              width: 230,
              height: 230,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(10,132,255,0.30) 0%, transparent 70%)',
              filter: 'blur(26px)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: c.green,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: c.green,
                      boxShadow: `0 0 8px ${c.green}`,
                    }}
                  />
                  Активна
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Premium
                </div>
                <div style={{ marginTop: 2, fontSize: 14, color: c.mute }}>290 ₽ в месяц</div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: c.primary,
                  background: 'rgba(10,132,255,0.14)',
                  border: '1px solid rgba(10,132,255,0.3)',
                  borderRadius: 9999,
                  padding: '5px 11px',
                }}
              >
                Тариф
              </span>
            </div>

            {/* Countdown */}
            <div
              style={{
                marginTop: 18,
                background: 'rgba(0,0,0,0.35)',
                borderRadius: 14,
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: c.faint,
                  marginBottom: 8,
                }}
              >
                До окончания
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                {[
                  { v: cd.days, l: 'дн' },
                  { v: cd.hours, l: 'ч' },
                  { v: cd.minutes, l: 'м' },
                  { v: cd.seconds, l: 'с' },
                ].map((u) => (
                  <div key={u.l} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span
                      style={{
                        fontSize: 26,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {String(u.v).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 12, color: c.faint }}>{u.l}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: c.mute }}>Продление 28 мая 2026</div>
            </div>
          </div>
        </div>

        {/* ─── Primary actions ─── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button style={btnPrimary}>Продлить</button>
          <button style={btnSecondary}>Сменить тариф</button>
        </div>

        {/* ─── Usage ─── */}
        <SectionLabel>Использование</SectionLabel>
        <div style={{ background: c.card, borderRadius: 16, overflow: 'hidden' }}>
          <UsageRow label="Трафик" value="42,1 / 100 ГБ" pct={trafficPct} action="Докупить" />
          <div style={{ height: 1, background: c.divider }} />
          <UsageRow label="Устройства" value="3 / 10" pct={devicePct} action="Добавить" />
        </div>

        {/* ─── Connection ─── */}
        <SectionLabel>Подключение</SectionLabel>
        <div style={{ background: c.card, borderRadius: 16, overflow: 'hidden' }}>
          <div
            style={{
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderBottom: `1px solid ${c.divider}`,
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
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              ⛓
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Ссылка подключения</div>
              <div
                style={{
                  fontSize: 12,
                  color: c.faint,
                  marginTop: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                vless://a1b2c3d4-…@nl.vpn.example:443
              </div>
            </div>
            <button
              onClick={() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              style={{
                flexShrink: 0,
                background: copied ? 'rgba(48,209,88,0.18)' : c.elevated,
                color: copied ? c.green : c.primary,
                border: 'none',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: font,
              }}
            >
              {copied ? '✓' : 'Копировать'}
            </button>
          </div>
          <button style={listRow}>
            <span style={iconTile}>⧉</span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={rowTitle}>Подключиться</span>
              <span style={rowSub}>Открыть в приложении · QR-код</span>
            </span>
            <span style={{ color: c.faint, fontSize: 18 }}>›</span>
          </button>
        </div>

        {/* ─── Servers ─── */}
        <SectionLabel>Серверы · 3 активны</SectionLabel>
        <div style={{ background: c.card, borderRadius: 16, overflow: 'hidden' }}>
          {servers.map((s, i) => (
            <div
              key={s.country}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: i === servers.length - 1 ? 'none' : `1px solid ${c.divider}`,
              }}
            >
              <div>
                <div style={{ fontSize: 15 }}>{s.country}</div>
                <div style={{ fontSize: 13, color: c.mute, marginTop: 1 }}>{s.city}</div>
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  color: s.ping < 50 ? c.green : s.ping < 100 ? c.amber : c.red,
                }}
              >
                {s.ping} мс
              </span>
            </div>
          ))}
          <button style={{ ...listRow, borderTop: `1px solid ${c.divider}` }}>
            <span style={iconTile}>+</span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={{ ...rowTitle, color: c.primary }}>Управление серверами</span>
            </span>
            <span style={{ color: c.faint, fontSize: 18 }}>›</span>
          </button>
        </div>

        {/* ─── Connected devices ─── */}
        <SectionLabel>Подключённые устройства</SectionLabel>
        <div style={{ background: c.card, borderRadius: 16, overflow: 'hidden' }}>
          {devices.map((d, i) => (
            <div
              key={d.name}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderBottom: i === devices.length - 1 ? 'none' : `1px solid ${c.divider}`,
              }}
            >
              <span style={iconTile}>{d.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: c.faint, marginTop: 1 }}>{d.meta}</div>
              </div>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: c.red,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: font,
                }}
              >
                Отвязать
              </button>
            </div>
          ))}
        </div>

        {/* ─── Management ─── */}
        <SectionLabel>Управление</SectionLabel>
        <div style={{ background: c.card, borderRadius: 16, overflow: 'hidden' }}>
          {/* Autopay toggle */}
          <div
            style={{
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderBottom: `1px solid ${c.divider}`,
            }}
          >
            <span style={iconTile}>↻</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15 }}>Автопродление</div>
              <div style={{ fontSize: 12, color: c.faint, marginTop: 1 }}>
                Списывать 290 ₽ с баланса
              </div>
            </div>
            <button
              onClick={() => setAutopay((v) => !v)}
              style={{
                width: 50,
                height: 30,
                borderRadius: 9999,
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                background: autopay ? c.green : c.elevated,
                transition: 'background 0.2s',
                display: 'flex',
                justifyContent: autopay ? 'flex-end' : 'flex-start',
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'block',
                }}
              />
            </button>
          </div>
          <button style={{ ...listRow, borderBottom: `1px solid ${c.divider}` }}>
            <span style={iconTile}>‖</span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={rowTitle}>Приостановить подписку</span>
            </span>
            <span style={{ color: c.faint, fontSize: 18 }}>›</span>
          </button>
          <button style={{ ...listRow, borderBottom: `1px solid ${c.divider}` }}>
            <span style={iconTile}>⟳</span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={rowTitle}>Перевыпустить ссылку</span>
              <span style={rowSub}>Старая ссылка перестанет работать</span>
            </span>
            <span style={{ color: c.faint, fontSize: 18 }}>›</span>
          </button>
          <button style={listRow}>
            <span style={{ ...iconTile, color: c.red }}>✕</span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={{ ...rowTitle, color: c.red }}>Удалить подписку</span>
            </span>
            <span style={{ color: c.faint, fontSize: 18 }}>›</span>
          </button>
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
        fgMute={c.mute}
        accent={c.primary}
      />
    </MobileFrame>
  );
}

// ── shared styles ──
const btnPrimary: React.CSSProperties = {
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
};
const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: c.elevated,
  color: c.primary,
};
const listRow: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: font,
};
const iconTile: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 9,
  background: c.elevated,
  display: 'grid',
  placeItems: 'center',
  color: c.primary,
  fontSize: 15,
  flexShrink: 0,
};
const rowTitle: React.CSSProperties = {
  display: 'block',
  fontSize: 15,
  color: c.ink,
};
const rowSub: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: c.faint,
  marginTop: 1,
};

function UsageRow({
  label,
  value,
  pct,
  action,
}: {
  label: string;
  value: string;
  pct: number;
  action: string;
}) {
  return (
    <div style={{ padding: '14px 16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 9,
        }}
      >
        <span style={{ fontSize: 15 }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: c.mute, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: c.primary }}>{action}</span>
        </span>
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
            background: c.primary,
          }}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 22,
        marginBottom: 9,
        padding: '0 6px',
        fontSize: 13,
        fontWeight: 600,
        color: c.mute,
      }}
    >
      {children}
    </div>
  );
}
