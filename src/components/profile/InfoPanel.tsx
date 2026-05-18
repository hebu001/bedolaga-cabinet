import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { infoApi, FaqPage } from '../../api/info';
import { infoPagesApi } from '../../api/infoPages';
import { promoApi, LoyaltyTierInfo } from '../../api/promo';
import type { FaqItem, ReplacesTab } from '../../api/infoPages';

const QuestionIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
    />
  </svg>
);

const DocumentIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
    />
  </svg>
);

const StarIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
    />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`h-5 w-5 shrink-0 text-apple-mute transition-transform ${expanded ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const Spinner = () => (
  <div className="flex justify-center py-8">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
  </div>
);

const BUILTIN_TABS = new Set<string>(['faq', 'rules', 'privacy', 'offer', 'loyalty']);

// Sanitize HTML content to prevent XSS
const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'b',
      'i',
      'u',
      'strong',
      'em',
      'a',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
      's',
      'del',
      'ins',
      'span',
      'div',
      'tg-spoiler',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'start'],
    ALLOW_DATA_ATTR: false,
  });
};

// Rich sanitizer for custom InfoPage content (TipTap editor output with media)
const ALLOWED_IFRAME_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'player.vimeo.com',
  'www.youtube-nocookie.com',
]);

const infoPagePurify = DOMPurify(window);

infoPagePurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IFRAME') {
    const src = node.getAttribute('src') ?? '';
    try {
      const url = new URL(src);
      if (url.protocol !== 'https:' || !ALLOWED_IFRAME_HOSTS.has(url.hostname)) {
        node.remove();
        return;
      }
    } catch {
      node.remove();
      return;
    }
    node.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    node.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
  }
  if (node.tagName === 'VIDEO') {
    const src = node.getAttribute('src') ?? '';
    try {
      const url = new URL(src);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        node.remove();
        return;
      }
    } catch {
      node.remove();
      return;
    }
    node.setAttribute('controls', '');
    node.setAttribute('preload', 'metadata');
  }
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  if (node.hasAttribute('style')) {
    const style = node.getAttribute('style') ?? '';
    const match = style.match(/text-align\s*:\s*(left|center|right|justify)/i);
    if (match) {
      node.setAttribute('style', `text-align: ${match[1]}`);
    } else {
      node.removeAttribute('style');
    }
  }
});

const RICH_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'div',
    'br',
    'hr',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'code',
    'ul',
    'ol',
    'li',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'a',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'ins',
    'span',
    'mark',
    'sub',
    'sup',
    'small',
    'img',
    'video',
    'iframe',
    'figure',
    'figcaption',
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'title',
    'width',
    'height',
    'loading',
    'class',
    'start',
    'reversed',
    'type',
    'controls',
    'preload',
    'frameborder',
    'allowfullscreen',
    'allow',
    'sandbox',
    'style',
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
};

const sanitizeRichHtml = (html: string): string => {
  return infoPagePurify.sanitize(html, RICH_SANITIZE_CONFIG);
};

// Convert content to formatted HTML (handles Telegram HTML + plain text)
const formatContent = (content: string): string => {
  if (!content) return '';

  const hasBlockHtml = /<(p|div|h[1-6]|ul|ol|blockquote)\b/i.test(content);

  if (hasBlockHtml) {
    return sanitizeHtml(content);
  }

  const result = content
    .split(/\n\n+/)
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';

      if (/^#{1,4}\s/.test(trimmed)) {
        const level = trimmed.match(/^(#{1,4})/)?.[1].length || 1;
        const text = trimmed.replace(/^#{1,4}\s*/, '');
        return `<h${level}>${text}</h${level}>`;
      }

      if (/^[-•]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
        const lines = trimmed.split('\n');
        const isOrdered = /^\d+[.)]\s/.test(lines[0]);
        const startNum = isOrdered ? parseInt(lines[0].match(/^(\d+)/)?.[1] || '1', 10) : 1;
        const listItems = lines
          .map((line) => line.replace(/^[-•]\s*/, '').replace(/^\d+[.)]\s*/, ''))
          .filter((line) => line.trim())
          .map((line) => `<li>${line}</li>`)
          .join('');
        return isOrdered ? `<ol start="${startNum}">${listItems}</ol>` : `<ul>${listItems}</ul>`;
      }

      const formatted = trimmed.split('\n').join('<br/>');
      return `<p>${formatted}</p>`;
    })
    .filter(Boolean)
    .join('');

  return sanitizeHtml(result);
};

// --- FAQ Accordion for tab replacements ---

function ReplacementFaqItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    const observer = new ResizeObserver(() => {
      if (contentRef.current) setHeight(contentRef.current.scrollHeight);
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  const sanitizedAnswer = useMemo(() => sanitizeRichHtml(item.a), [item.a]);

  return (
    <div className="overflow-hidden rounded-xl bg-apple-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-apple-ink">{item.q}</span>
        <ChevronIcon expanded={isOpen} />
      </button>
      <div
        style={{ height }}
        className="overflow-hidden transition-[height] duration-300 ease-in-out"
      >
        <div ref={contentRef} className="border-t border-apple-hairline px-4 pb-4 pt-3">
          <div
            className="prose prose-sm prose-invert max-w-none text-apple-mute"
            dangerouslySetInnerHTML={{ __html: sanitizedAnswer }}
          />
        </div>
      </div>
    </div>
  );
}

function ReplacementFaqView({ items }: { items: FaqItem[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const handleToggle = useCallback((key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  }, []);

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const key = `${index}-${item.q.slice(0, 50)}`;
        return (
          <ReplacementFaqItem
            key={key}
            item={item}
            isOpen={openKey === key}
            onToggle={() => handleToggle(key)}
          />
        );
      })}
    </div>
  );
}

/** Help / info center, restyled apple-dark for inline embedding. */
export default function InfoPanel() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('faq');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const locale = i18n.language.split('-')[0];

  const { data: tabReplacements, isError: replacementsError } = useQuery({
    queryKey: ['info-pages', 'tab-replacements'],
    queryFn: infoPagesApi.getTabReplacements,
    staleTime: 60_000,
  });

  const { data: customPages } = useQuery({
    queryKey: ['info-pages', 'list'],
    queryFn: () => infoPagesApi.getPages(),
    staleTime: 60_000,
  });

  const extraPages = useMemo(
    () => (customPages ?? []).filter((p) => !p.replaces_tab && !BUILTIN_TABS.has(p.slug)),
    [customPages],
  );

  const isCustomTab = !BUILTIN_TABS.has(activeTab);
  const customTabSlug = isCustomTab ? activeTab : null;

  const currentTabSlug =
    !isCustomTab && activeTab !== 'loyalty'
      ? (tabReplacements?.[activeTab as ReplacesTab] ?? null)
      : null;

  const pageSlugToFetch = customTabSlug ?? currentTabSlug;

  const replacementsLoaded = tabReplacements !== undefined || replacementsError;

  const { data: infoPage, isLoading: infoPageLoading } = useQuery({
    queryKey: ['info-pages', 'page', pageSlugToFetch],
    queryFn: () => {
      if (!pageSlugToFetch) throw new Error('No slug');
      return infoPagesApi.getPageBySlug(pageSlugToFetch);
    },
    enabled: !!pageSlugToFetch,
    staleTime: 60_000,
  });

  const infoPageFaqItems = useMemo((): FaqItem[] => {
    if (!infoPage || infoPage.page_type !== 'faq') return [];
    const raw =
      infoPage.content[locale] || infoPage.content['ru'] || infoPage.content['en'] || '[]';
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [infoPage, locale]);

  const infoPageHtml = useMemo(() => {
    if (!infoPage || infoPage.page_type === 'faq') return '';
    const rawContent =
      infoPage.content[locale] || infoPage.content['ru'] || infoPage.content['en'] || '';
    return sanitizeRichHtml(rawContent);
  }, [infoPage, locale]);

  const { data: faqPages, isLoading: faqLoading } = useQuery({
    queryKey: ['faq-pages'],
    queryFn: infoApi.getFaqPages,
    enabled: activeTab === 'faq' && !currentTabSlug && replacementsLoaded,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: infoApi.getRules,
    enabled: activeTab === 'rules' && !currentTabSlug && replacementsLoaded,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: privacy, isLoading: privacyLoading } = useQuery({
    queryKey: ['privacy-policy'],
    queryFn: infoApi.getPrivacyPolicy,
    enabled: activeTab === 'privacy' && !currentTabSlug && replacementsLoaded,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: offer, isLoading: offerLoading } = useQuery({
    queryKey: ['public-offer'],
    queryFn: infoApi.getPublicOffer,
    enabled: activeTab === 'offer' && !currentTabSlug && replacementsLoaded,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: loyaltyData, isLoading: loyaltyLoading } = useQuery({
    queryKey: ['loyalty-tiers'],
    queryFn: promoApi.getLoyaltyTiers,
    enabled: activeTab === 'loyalty',
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const builtinTabs: Array<{ id: string; label: string; icon: React.FC; emoji?: string }> = [
    { id: 'faq', label: t('info.faq'), icon: QuestionIcon },
    { id: 'rules', label: t('info.rules'), icon: DocumentIcon },
    { id: 'privacy', label: t('info.privacy'), icon: ShieldIcon },
    { id: 'offer', label: t('info.offer'), icon: DocumentIcon },
    { id: 'loyalty', label: t('info.loyalty'), icon: StarIcon },
  ];

  const customTabs = extraPages.map((p) => {
    const label = p.title[locale] || p.title['ru'] || p.title['en'] || p.slug;
    return { id: p.slug, label, icon: DocumentIcon, emoji: p.icon ?? undefined };
  });

  const tabs = [...builtinTabs, ...customTabs];

  const toggleFaq = useCallback((id: number) => {
    setExpandedFaq((prev) => (prev === id ? null : id));
  }, []);

  const richProse = 'prose prose-sm prose-invert max-w-none text-apple-mute';

  const renderInfoPageContent = () => {
    if (infoPageLoading) return <Spinner />;

    if (!infoPage) {
      return <div className="py-8 text-center text-apple-mute">{t('info.noContent')}</div>;
    }

    if (infoPage.page_type === 'faq') {
      if (infoPageFaqItems.length === 0) {
        return <div className="py-8 text-center text-apple-mute">{t('info.noFaq')}</div>;
      }
      return <ReplacementFaqView items={infoPageFaqItems} />;
    }

    if (!infoPageHtml) {
      return <div className="py-8 text-center text-apple-mute">{t('info.noContent')}</div>;
    }

    return (
      <div className="rounded-xl bg-apple-card p-4">
        <div
          className={`${richProse} overflow-x-auto`}
          dangerouslySetInnerHTML={{ __html: infoPageHtml }}
        />
      </div>
    );
  };

  const renderContent = () => {
    if (isCustomTab) {
      return renderInfoPageContent();
    }

    if (!replacementsLoaded) {
      return <Spinner />;
    }

    if (currentTabSlug) {
      return renderInfoPageContent();
    }

    if (activeTab === 'faq') {
      if (faqLoading) return <Spinner />;

      if (!faqPages || faqPages.length === 0) {
        return <div className="py-8 text-center text-apple-mute">{t('info.noFaq')}</div>;
      }

      return (
        <div className="space-y-2">
          {faqPages.map((faq: FaqPage) => (
            <div key={faq.id} className="overflow-hidden rounded-xl bg-apple-card">
              <button
                type="button"
                onClick={() => toggleFaq(faq.id)}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className="text-sm font-medium text-apple-ink">{faq.title}</span>
                <ChevronIcon expanded={expandedFaq === faq.id} />
              </button>
              {expandedFaq === faq.id && (
                <div className="border-t border-apple-hairline px-4 pb-4 pt-3">
                  <div
                    className={richProse}
                    dangerouslySetInnerHTML={{ __html: formatContent(faq.content) }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'rules') {
      if (rulesLoading) return <Spinner />;
      if (!rules?.content) {
        return <div className="py-8 text-center text-apple-mute">{t('info.noContent')}</div>;
      }
      return (
        <div className="rounded-xl bg-apple-card p-4">
          <div
            className={`${richProse} overflow-x-auto`}
            dangerouslySetInnerHTML={{ __html: formatContent(rules.content) }}
          />
          {rules.updated_at && (
            <p className="mt-6 border-t border-apple-hairline pt-4 text-sm text-apple-faint">
              {t('info.updatedAt')}: {new Date(rules.updated_at).toLocaleDateString()}
            </p>
          )}
        </div>
      );
    }

    if (activeTab === 'privacy') {
      if (privacyLoading) return <Spinner />;
      if (!privacy?.content) {
        return <div className="py-8 text-center text-apple-mute">{t('info.noContent')}</div>;
      }
      return (
        <div className="rounded-xl bg-apple-card p-4">
          <div
            className={`${richProse} overflow-x-auto`}
            dangerouslySetInnerHTML={{ __html: formatContent(privacy.content) }}
          />
          {privacy.updated_at && (
            <p className="mt-6 border-t border-apple-hairline pt-4 text-sm text-apple-faint">
              {t('info.updatedAt')}: {new Date(privacy.updated_at).toLocaleDateString()}
            </p>
          )}
        </div>
      );
    }

    if (activeTab === 'offer') {
      if (offerLoading) return <Spinner />;
      if (!offer?.content) {
        return <div className="py-8 text-center text-apple-mute">{t('info.noContent')}</div>;
      }
      return (
        <div className="rounded-xl bg-apple-card p-4">
          <div
            className={`${richProse} overflow-x-auto`}
            dangerouslySetInnerHTML={{ __html: formatContent(offer.content) }}
          />
          {offer.updated_at && (
            <p className="mt-6 border-t border-apple-hairline pt-4 text-sm text-apple-faint">
              {t('info.updatedAt')}: {new Date(offer.updated_at).toLocaleDateString()}
            </p>
          )}
        </div>
      );
    }

    if (activeTab === 'loyalty') {
      if (loyaltyLoading) return <Spinner />;

      if (!loyaltyData || loyaltyData.tiers.length === 0) {
        return <div className="py-8 text-center text-apple-mute">{t('info.noLoyaltyTiers')}</div>;
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: 'RUB',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount);
      };

      const getStatusBadge = (tier: LoyaltyTierInfo) => {
        if (tier.is_current) {
          return (
            <span className="rounded-full bg-[#F97315]/15 px-2 py-1 text-xs font-medium text-[#F97315]">
              {t('info.statusCurrent')}
            </span>
          );
        }
        if (tier.is_achieved) {
          return (
            <span className="rounded-full bg-apple-green/15 px-2 py-1 text-xs font-medium text-apple-green">
              {t('info.statusAchieved')}
            </span>
          );
        }
        return (
          <span className="rounded-full bg-apple-elevated px-2 py-1 text-xs font-medium text-apple-faint">
            {t('info.statusLocked')}
          </span>
        );
      };

      const hasAnyDiscount = (tier: LoyaltyTierInfo) => {
        return (
          tier.server_discount_percent > 0 ||
          tier.traffic_discount_percent > 0 ||
          tier.device_discount_percent > 0 ||
          Object.keys(tier.period_discounts).length > 0
        );
      };

      return (
        <div className="space-y-4">
          {/* Progress Card */}
          <div className="rounded-xl bg-apple-card p-4">
            <h3 className="mb-4 text-[15px] font-semibold text-apple-ink">
              {t('info.yourProgress')}
            </h3>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-apple-elevated p-3">
                <div className="mb-1 text-xs text-apple-mute">{t('info.totalSpent')}</div>
                <div className="truncate text-base font-bold text-apple-ink">
                  {formatCurrency(loyaltyData.current_spent_rubles)}
                </div>
              </div>
              <div className="rounded-xl bg-apple-elevated p-3">
                <div className="mb-1 text-xs text-apple-mute">{t('info.currentStatus')}</div>
                <div className="truncate text-base font-bold text-[#F97315]">
                  {loyaltyData.current_tier_name || '-'}
                </div>
              </div>
            </div>

            {loyaltyData.next_tier_name && loyaltyData.next_tier_threshold_rubles ? (
              <div>
                <div className="mb-2 flex flex-col gap-1 text-xs text-apple-mute sm:flex-row sm:justify-between">
                  <span>
                    {t('info.nextStatus')}: {loyaltyData.next_tier_name}
                  </span>
                  <span>
                    {t('info.toNextStatus')}:{' '}
                    {formatCurrency(
                      Math.max(
                        0,
                        loyaltyData.next_tier_threshold_rubles - loyaltyData.current_spent_rubles,
                      ),
                    )}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-apple-elevated">
                  <div
                    className="h-full rounded-full bg-[#F97315] transition-all duration-500"
                    style={{ width: `${Math.min(100, loyaltyData.progress_percent)}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-xs text-apple-mute">
                  {loyaltyData.progress_percent.toFixed(1)}%
                </div>
              </div>
            ) : (
              <div className="py-2 text-center font-medium text-apple-green">
                {t('info.allStatusesAchieved')}
              </div>
            )}
          </div>

          {/* Tiers List */}
          <div className="space-y-2">
            {loyaltyData.tiers.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-xl bg-apple-card p-4 ${
                  tier.is_current
                    ? 'ring-2 ring-[#F97315]/50'
                    : tier.is_achieved
                      ? ''
                      : 'opacity-70'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        tier.is_current
                          ? 'bg-[#F97315]/15 text-[#F97315]'
                          : tier.is_achieved
                            ? 'bg-apple-green/15 text-apple-green'
                            : 'bg-apple-elevated text-apple-faint'
                      }`}
                    >
                      <StarIcon />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate font-semibold text-apple-ink">{tier.name}</h4>
                      <p className="text-xs text-apple-mute">
                        {t('info.threshold')}: {formatCurrency(tier.threshold_rubles)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0">{getStatusBadge(tier)}</span>
                </div>

                {hasAnyDiscount(tier) ? (
                  <div className="rounded-xl bg-apple-elevated p-3">
                    <div className="mb-2 text-xs text-apple-mute">{t('info.discounts')}:</div>
                    <div className="flex flex-wrap gap-2">
                      {tier.server_discount_percent > 0 && (
                        <span className="rounded-lg bg-apple-card px-2 py-1 text-xs text-apple-ink">
                          {t('info.serverDiscount')}: -{tier.server_discount_percent}%
                        </span>
                      )}
                      {tier.traffic_discount_percent > 0 && (
                        <span className="rounded-lg bg-apple-card px-2 py-1 text-xs text-apple-ink">
                          {t('info.trafficDiscount')}: -{tier.traffic_discount_percent}%
                        </span>
                      )}
                      {tier.device_discount_percent > 0 && (
                        <span className="rounded-lg bg-apple-card px-2 py-1 text-xs text-apple-ink">
                          {t('info.deviceDiscount')}: -{tier.device_discount_percent}%
                        </span>
                      )}
                      {Object.entries(tier.period_discounts).map(([days, percent]) => (
                        <span
                          key={days}
                          className="rounded-lg bg-apple-card px-2 py-1 text-xs text-apple-ink"
                        >
                          {t('info.periodDiscount', { days })}: -{percent}%
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs italic text-apple-faint">{t('info.noDiscounts')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex min-h-[40px] shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#F97315] text-white'
                : 'bg-apple-elevated text-apple-mute hover:text-apple-ink'
            }`}
          >
            {tab.emoji ? <span className="text-base">{tab.emoji}</span> : <tab.icon />}
            <span className="max-w-[140px] truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}
