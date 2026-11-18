import { InstitutionSettings } from '../types';

const PWA_ICON_CACHE_KEY = 'ghaith_pwa_icon_cache_v2';
const LEGACY_PWA_ICON_CACHE_KEY = 'ghaith_pwa_icon_cache_v1';

interface CachedPwaIconBundle {
  logoUrl: string;
  primaryColor: string;
  institutionName: string;
  icon180: string;
  icon192: string;
  icon512: string;
  maskable512: string;
}

let activeManifestBlobUrl: string | null = null;
let lastSyncedSignature = '';

function hashLogoSignature(settings?: Partial<InstitutionSettings>): string {
  const logoUrl = (settings?.logoUrl || '').trim();
  const primaryColor = (settings?.primaryColor || '#78350F').trim();
  const institutionName = (settings?.name || 'مقرأة غيث الغيم').trim();
  const logoFingerprint =
    logoUrl.length > 160
      ? `${logoUrl.slice(0, 64)}:${logoUrl.length}:${logoUrl.slice(-64)}`
      : logoUrl;
  return `${logoFingerprint}|${primaryColor}|${institutionName}`;
}

async function purgeLegacyDefaultIconCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_PWA_ICON_CACHE_KEY);
  } catch {
    // Ignore storage restriction
  }
  if (!('caches' in window)) return;
  try {
    const cacheNames = await window.caches.keys();
    const legacyPaths = [
      '/pwa-192x192.png',
      '/pwa-512x512.png',
      '/pwa-maskable-512x512.png',
      '/apple-touch-icon.png',
      '/favicon.ico',
      '/icon.svg',
    ];
    for (const name of cacheNames) {
      const cache = await window.caches.open(name);
      for (const path of legacyPaths) {
        await cache.delete(path).catch(() => {});
      }
    }
  } catch {
    // Ignore CacheStorage restriction
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load logo image'));
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function renderAppIconDataUrl(
  img: HTMLImageElement,
  size: number,
  options: { maskable?: boolean } = {}
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Clean warm ivory background so transparent or rectangular logos look crisp on iOS/Android
  ctx.fillStyle = '#FAF8F6';
  if (options.maskable) {
    ctx.fillRect(0, 0, size, size);
  } else {
    drawRoundedRect(ctx, 0, 0, size, size, Math.round(size * 0.18));
    ctx.fill();
  }

  // Safe zone padding: 14% for maskable icons, 8% for standard icons
  const paddingRatio = options.maskable ? 0.14 : 0.08;
  const maxBox = size * (1 - paddingRatio * 2);
  const naturalW = img.naturalWidth || img.width || size;
  const naturalH = img.naturalHeight || img.height || size;
  const scale = Math.min(maxBox / naturalW, maxBox / naturalH);
  const drawW = naturalW * scale;
  const drawH = naturalH * scale;
  const drawX = (size - drawW) / 2;
  const drawY = (size - drawH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  return canvas.toDataURL('image/png');
}

function upsertHeadLink(rel: string, attrs: Record<string, string>): HTMLLinkElement {
  let link = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  Object.entries(attrs).forEach(([k, v]) => {
    link!.setAttribute(k, v);
  });
  return link;
}

function removeHeadLink(rel: string) {
  const links = document.head.querySelectorAll(`link[rel="${rel}"]`);
  links.forEach(link => link.parentNode?.removeChild(link));
}

function applyIconBundleToDocument(bundle: CachedPwaIconBundle) {
  if (typeof document === 'undefined') return;

  if (bundle.icon180 && bundle.icon192) {
    // 1. Update iOS Home Screen Icon (apple-touch-icon)
    upsertHeadLink('apple-touch-icon', {
      sizes: '180x180',
      href: bundle.icon180,
    });

    // 2. Update Standard Favicon & Shortcut Icon
    upsertHeadLink('icon', {
      type: 'image/png',
      sizes: '192x192',
      href: bundle.icon192,
    });
    upsertHeadLink('shortcut icon', {
      type: 'image/png',
      href: bundle.icon192,
    });
  } else {
    removeHeadLink('apple-touch-icon');
    removeHeadLink('icon');
    removeHeadLink('shortcut icon');
  }

  // 3. Update Apple Web App Title & Theme Color
  const appleTitleMeta = document.head.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitleMeta) {
    appleTitleMeta.setAttribute('content', bundle.institutionName || 'غيث الغيم');
  }
  const themeColorMeta = document.head.querySelector('meta[name="theme-color"]');
  if (themeColorMeta && bundle.primaryColor) {
    themeColorMeta.setAttribute('content', bundle.primaryColor);
  }

  // 4. Update Web App Manifest dynamically with institution logo & name
  const manifestObj: Record<string, unknown> = {
    id: window.location.origin + '/',
    name: bundle.institutionName || 'مقرأة غيث الغيم',
    short_name: bundle.institutionName || 'غيث الغيم',
    description: 'منصة الإدارة والتمكين القرآني المتكاملة وحلقات الحفظ المتقن',
    theme_color: bundle.primaryColor || '#78350F',
    background_color: '#FAF5F2',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'ar',
    start_url: window.location.origin + '/',
    scope: window.location.origin + '/',
    icons:
      bundle.icon192 && bundle.icon512
        ? [
            {
              src: bundle.icon192,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: bundle.icon512,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: bundle.maskable512 || bundle.icon512,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ]
        : [],
  };

  try {
    const blob = new Blob([JSON.stringify(manifestObj)], { type: 'application/manifest+json' });
    const nextManifestUrl = URL.createObjectURL(blob);
    upsertHeadLink('manifest', { href: nextManifestUrl });
    if (activeManifestBlobUrl) {
      URL.revokeObjectURL(activeManifestBlobUrl);
    }
    activeManifestBlobUrl = nextManifestUrl;
  } catch {
    // Fallback if Blob URL creation is restricted
  }
}

export async function syncInstitutionLogoAsPWAAppIcon(
  settings?: Partial<InstitutionSettings>
): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  await purgeLegacyDefaultIconCaches();

  const signature = hashLogoSignature(settings);
  if (signature === lastSyncedSignature) return;

  const logoUrl = (settings?.logoUrl || '').trim();
  const primaryColor = (settings?.primaryColor || '#78350F').trim();
  const institutionName = (settings?.name || 'مقرأة غيث الغيم').trim();

  // If no custom logo is uploaded yet, apply clean metadata without any fake default icon
  if (!logoUrl) {
    lastSyncedSignature = signature;
    applyIconBundleToDocument({
      logoUrl: '',
      primaryColor,
      institutionName,
      icon180: '',
      icon192: '',
      icon512: '',
      maskable512: '',
    });
    return;
  }

  // Fast path: reuse cached icon bundle if logo & metadata haven't changed
  try {
    const rawCache = localStorage.getItem(PWA_ICON_CACHE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache) as CachedPwaIconBundle;
      if (
        parsed &&
        parsed.logoUrl === logoUrl &&
        parsed.primaryColor === primaryColor &&
        parsed.institutionName === institutionName &&
        parsed.icon180 &&
        parsed.icon192 &&
        parsed.icon512
      ) {
        lastSyncedSignature = signature;
        applyIconBundleToDocument(parsed);
        return;
      }
    }
  } catch {
    // Ignore storage read errors
  }

  try {
    const img = await loadImageElement(logoUrl);
    const icon180 = renderAppIconDataUrl(img, 180, { maskable: false }) || logoUrl;
    const icon192 = renderAppIconDataUrl(img, 192, { maskable: false }) || logoUrl;
    const icon512 = renderAppIconDataUrl(img, 512, { maskable: false }) || logoUrl;
    const maskable512 = renderAppIconDataUrl(img, 512, { maskable: true }) || icon512;

    const bundle: CachedPwaIconBundle = {
      logoUrl,
      primaryColor,
      institutionName,
      icon180,
      icon192,
      icon512,
      maskable512,
    };

    lastSyncedSignature = signature;
    applyIconBundleToDocument(bundle);

    try {
      localStorage.setItem(PWA_ICON_CACHE_KEY, JSON.stringify(bundle));
    } catch {
      // Ignore quota errors if localStorage is full
    }
  } catch {
    // Direct fallback using user's logoUrl if canvas tainting occurs on external URLs
    const fallbackBundle: CachedPwaIconBundle = {
      logoUrl,
      primaryColor,
      institutionName,
      icon180: logoUrl,
      icon192: logoUrl,
      icon512: logoUrl,
      maskable512: logoUrl,
    };
    lastSyncedSignature = signature;
    applyIconBundleToDocument(fallbackBundle);
  }
}
