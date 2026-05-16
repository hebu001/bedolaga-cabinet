import { Link } from 'react-router';

const variants = [
  {
    slug: 'stripe',
    name: 'Stripe',
    tagline: 'Indigo gradients · weight-300 elegance',
    swatch: ['#533afd', '#0d253d', '#f6f9fc', '#ea2261'],
    bg: 'linear-gradient(135deg, #f6f9fc 0%, #e0e7ff 50%, #ffd4f1 100%)',
    fg: '#0d253d',
  },
  {
    slug: 'revolut',
    name: 'Revolut',
    tagline: 'Premium banking · gradient cards',
    swatch: ['#4f55f1', '#16181a', '#000000', '#7c3aed'],
    bg: 'radial-gradient(circle at 100% 0%, #2a2eaf 0%, transparent 60%), linear-gradient(135deg, #000 0%, #16181a 100%)',
    fg: '#ffffff',
  },
  {
    slug: 'linear',
    name: 'Linear',
    tagline: 'Ultra-minimal · hairline borders',
    swatch: ['#5e6ad2', '#010102', '#0f1011', '#23252a'],
    bg: 'linear-gradient(180deg, #010102 0%, #0f1011 100%)',
    fg: '#f7f8f8',
  },
  {
    slug: 'supabase',
    name: 'Supabase',
    tagline: 'Emerald · terminal-native',
    swatch: ['#3ecf8e', '#171717', '#1c1c1c', '#24b47e'],
    bg: 'linear-gradient(135deg, #171717 0%, #1c1c1c 100%)',
    fg: '#ededed',
  },
  {
    slug: 'lamborghini',
    name: 'Lamborghini',
    tagline: 'True black · gold accent · zero-radius',
    swatch: ['#FFC000', '#000000', '#202020', '#FFCE3E'],
    bg: 'linear-gradient(135deg, #000 0%, #181818 100%)',
    fg: '#ffffff',
  },
  {
    slug: 'bugatti',
    name: 'Bugatti',
    tagline: 'Cinema-black · monochrome austerity',
    swatch: ['#ffffff', '#000000', '#141414', '#3a3a3a'],
    bg: 'linear-gradient(135deg, #000 0%, #0d0d0d 100%)',
    fg: '#ffffff',
  },
  {
    slug: 'binance',
    name: 'Binance',
    tagline: 'Binance Yellow · trading-floor urgency',
    swatch: ['#fcd535', '#0b0e11', '#1e2329', '#0ecb81'],
    bg: 'radial-gradient(circle at 100% 0%, #3a3a1f 0%, transparent 60%), linear-gradient(135deg, #0b0e11 0%, #1e2329 100%)',
    fg: '#eaecef',
  },
  {
    slug: 'apple',
    name: 'Apple',
    tagline: 'iOS dark mode · SF Pro · #0a84ff accent',
    swatch: ['#0a84ff', '#000000', '#1c1c1e', '#30d158'],
    bg: 'linear-gradient(135deg, #1c1c1e 0%, #000000 100%)',
    fg: '#f5f5f7',
  },
];

// dark foreground colour => the card itself is light
const isLight = (fg: string) => fg === '#0d253d';

export default function PreviewIndex() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#08080a',
        color: '#e5e7eb',
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Inter, sans-serif',
        padding: '32px 16px 64px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#71717a',
              marginBottom: 10,
            }}
          >
            Design previews · bedolaga-cabinet · mobile
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: 0,
              marginBottom: 10,
              lineHeight: 1.15,
            }}
          >
            /balance &nbsp;·&nbsp; /subscription
          </h1>
          <p
            style={{
              color: '#a1a1aa',
              maxWidth: 540,
              lineHeight: 1.5,
              fontSize: 14,
              margin: 0,
            }}
          >
            16 экранов · 8 дизайн-систем × 2 страницы. Оптимизированы под
            мобильное разрешение (~390px). Внизу — sticky-таб для переключения
            между Balance и Subscription внутри выбранной системы.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 16 }}>
          {variants.map((v) => (
            <div
              key={v.slug}
              style={{
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.08)',
                background: v.bg,
                color: v.fg,
                padding: '20px 20px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {v.name}
                  </div>
                  <div
                    style={{
                      color: isLight(v.fg) ? '#64748d' : '#cbd5e1',
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {v.tagline}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {v.swatch.map((s) => (
                    <span
                      key={s}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: s,
                        border: '1px solid rgba(0,0,0,0.12)',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}
              >
                <Link
                  to={`/preview/${v.slug}/balance`}
                  style={{
                    textAlign: 'center',
                    textDecoration: 'none',
                    padding: '12px 10px',
                    background:
                      isLight(v.fg)
                        ? 'rgba(13,37,61,0.08)'
                        : 'rgba(255,255,255,0.10)',
                    color: v.fg,
                    border:
                      isLight(v.fg)
                        ? '1px solid rgba(13,37,61,0.12)'
                        : '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                  }}
                >
                  /balance →
                </Link>
                <Link
                  to={`/preview/${v.slug}/subscription`}
                  style={{
                    textAlign: 'center',
                    textDecoration: 'none',
                    padding: '12px 10px',
                    background:
                      isLight(v.fg)
                        ? 'rgba(13,37,61,0.08)'
                        : 'rgba(255,255,255,0.10)',
                    color: v.fg,
                    border:
                      isLight(v.fg)
                        ? '1px solid rgba(13,37,61,0.12)'
                        : '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                  }}
                >
                  /subscription →
                </Link>
              </div>
            </div>
          ))}
        </div>

        <footer
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            color: '#52525b',
            fontSize: 11,
            textAlign: 'center',
          }}
        >
          Source:{' '}
          <code style={{ color: '#a1a1aa' }}>docs/design-options/*.md</code>
        </footer>
      </div>
    </div>
  );
}
