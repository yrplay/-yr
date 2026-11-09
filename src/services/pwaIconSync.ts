import { InstitutionSettings } from '../types';

const PWA_ICON_CACHE_KEY = 'ghaith_pwa_icon_cache_v1';

interface CachedPWAIcons {
  sourceLogoUrl: string;
  siteName: string;
  primaryColor: string;
  icon180: string;
  icon192: string;
  icon512: string;
  iconMaskable512: string;
}

let activeManifestBlobUrl: string | null = null;

/**
 * Renders any image source onto a square PNG canvas of `size x size`.
 * Ensures exact pixel dimensions required by Chromium Web App Manifest & iOS Safari apple-touch-icon.
 */
function renderLogoToSquarePng(
  img: HTMLImageElement,
  size: number,
  options: { paddingRatio?: number; backgroundColor?: string; roundedBg?: boolean } = {}
): string {
  const { paddingRatio = 0.06, backgroundColor = '#FFFFFF', roundedBg = false } = options;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  ctx.clearRect(0, 0, size, size);

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    if (roundedBg) {
      const r = Math.round(size * 0.22);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(size - r, 0);
      ctx.quadraticCurveTo(size, 0, size, r);
      ctx.lineTo(size, size - r);
      ctx.quadraticCurveTo(size, size, size - r, size);
      ctx.lineTo(r, size);
      ctx.quadraticCurveTo(0, size, 0, size - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, size, size);
    }
  }

  const pad = Math.round(size * paddingRatio);
  const availW = size - pad * 2;
  const availH = size - pad * 2;

  const natW = img.naturalWidth || img.width || size;
  const natH = img.naturalHeight || img.height || size;
  const scale = Math.min(availW / natW, availH / natH);

  const drawW = Math.round(natW * scale);
  const drawH = Math.round(natH * scale);
  const offsetX = Math.round((size - drawW) / 2);
  const offsetY = Math.round((size - drawH) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

  return canvas.toDataURL('image/png');
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Updates Service Worker / Browser Cache Storage entries for static PWA icon paths
 * so any direct request to /pwa-192x192.png, /pwa-512x512.png, or /apple-touch-icon.png
 * resolves to the institution's custom logo.
 */
async function updateCacheStorageIcons(icons: {
  icon180: string;
  icon192: string;
  icon512: string;
  iconMaskable512: string;
}) {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const blob180 = dataUrlToBlob(icons.icon180);
    const blob192 = dataUrlToBlob(icons.icon192);
    const blob512 = dataUrlToBlob(icons.icon512);
    const blobMaskable = dataUrlToBlob(icons.iconMaskable512);
    if (!blob180 || !blob192 || !blob512 || !blobMaskable) return;

    const cacheNames = await window.caches.keys();
    const targetCaches = cacheNames.length > 0 ? cacheNames : ['ghaith-pwa-icons-runtime'];

    for (const cacheName of targetCaches) {
      const cache = await window.caches.open(cacheName);
      const putPng = async (urlPath: string, blob: Blob) => {
        const response = new Response(blob, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000',
          },
        });
        await cache.put(new URL(urlPath, window.location.origin).href, response);
      };

      await Promise.all([
        putPng('/apple-touch-icon.png', blob180),
        putPng('/pwa-192x192.png', blob192),
        putPng('/pwa-512x512.png', blob512),
        putPng('/pwa-maskable-512x512.png', blobMaskable),
      ]);
    }
  } catch {
    // Ignore cache storage errors in restricted contexts
  }
}

function applyIconsAndManifestToDom(params: {
  siteName: string;
  shortName: string;
  description: string;
  themeColor: string;
  icon180: string;
  icon192: string;
  icon512: string;
  iconMaskable512: string;
}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const {
    siteName,
    shortName,
    description,
    themeColor,
    icon180,
    icon192,
    icon512,
    iconMaskable512,
  } = params;

  // 1. Update Favicon & Apple Touch Icons in <head>
  const setHeadLink = (selector: string, rel: string, href: string, sizes?: string, type?: string) => {
    let link = document.querySelector(selector) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
    if (sizes) link.sizes.value = sizes;
    if (type) link.type = type;
  };

  setHeadLink("link[rel='icon']", 'icon', icon192, '192x192', 'image/png');
  setHeadLink("link[rel='shortcut icon']", 'shortcut icon', icon192, '192x192', 'image/png');

  // Update all apple-touch-icon links for iOS Home Screen installation
  const appleLinks = document.querySelectorAll("link[rel='apple-touch-icon'], link[rel='apple-touch-icon-precomposed']");
  if (appleLinks.length > 0) {
    appleLinks.forEach((el) => {
      const link = el as HTMLLinkElement;
      link.href = icon180;
    });
  } else {
    setHeadLink("link[rel='apple-touch-icon']", 'apple-touch-icon', icon180, '180x180');
  }

  // 2. Update Meta Titles & Theme Color
  const appleTitleMeta = document.querySelector("meta[name='apple-mobile-web-app-title']") as HTMLMetaElement | null;
  if (appleTitleMeta) appleTitleMeta.content = shortName;

  const themeColorMeta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
  if (themeColorMeta) themeColorMeta.content = themeColor;

  // 3. Build Dynamic Web App Manifest with absolute URLs and exact PNG data URLs
  const origin = window.location.origin;
  const manifestObj = {
    id: `${origin}/`,
    name: siteName,
    short_name: shortName,
    description,
    theme_color: themeColor,
    background_color: '#FAF5F2',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'ar',
    start_url: `${origin}/`,
    scope: `${origin}/`,
    icons: [
      {
        src: icon192,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icon512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: iconMaskable512,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  try {
    const manifestJson = JSON.stringify(manifestObj);
    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    if (activeManifestBlobUrl) {
      URL.revokeObjectURL(activeManifestBlobUrl);
      activeManifestBlobUrl = null;
    }

    const blob = new Blob([manifestJson], { type: 'application/manifest+json' });
    activeManifestBlobUrl = URL.createObjectURL(blob);
    manifestLink.href = activeManifestBlobUrl;
  } catch {
    // Fallback if Blob URL creation fails
  }
}

/**
 * Synchronizes the institution logo (`settings.logoUrl`) with all browser & OS
 * app-installation icons (PWA Web App Manifest, iOS apple-touch-icon, Favicons, and Cache Storage).
 */
export function syncInstitutionLogoAsPWAAppIcon(settings?: Partial<InstitutionSettings> | null): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const siteName = (settings?.name || 'مقرأة غيث الغيم').trim();
  const shortName = (siteName.replace(/^مقرأة\s+/, '').trim() || siteName).slice(0, 12);
  const description =
    settings?.subtitle || 'منصة الإدارة والتمكين القرآني المتكاملة وحلقات الحفظ المتقن';
  const themeColor = settings?.primaryColor || '#8E5364';
  const sourceLogoUrl = (settings?.logoUrl || '').trim() || '/pwa-512x512.png';

  // Check if we already generated and cached the exact same logo & branding
  try {
    const rawCache = localStorage.getItem(PWA_ICON_CACHE_KEY);
    if (rawCache) {
      const cached: CachedPWAIcons = JSON.parse(rawCache);
      if (
        cached &&
        cached.sourceLogoUrl === sourceLogoUrl &&
        cached.siteName === siteName &&
        cached.primaryColor === themeColor &&
        cached.icon180 &&
        cached.icon192 &&
        cached.icon512 &&
        cached.iconMaskable512
      ) {
        applyIconsAndManifestToDom({
          siteName,
          shortName,
          description,
          themeColor,
          icon180: cached.icon180,
          icon192: cached.icon192,
          icon512: cached.icon512,
          iconMaskable512: cached.iconMaskable512,
        });
        void updateCacheStorageIcons(cached);
        return;
      }
    }
  } catch {
    // Proceed to fresh generation
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const icon180 = renderLogoToSquarePng(img, 180, {
        paddingRatio: 0.06,
        backgroundColor: '#FFFFFF',
      });
      const icon192 = renderLogoToSquarePng(img, 192, {
        paddingRatio: 0.05,
        backgroundColor: '#FFFFFF',
        roundedBg: true,
      });
      const icon512 = renderLogoToSquarePng(img, 512, {
        paddingRatio: 0.05,
        backgroundColor: '#FFFFFF',
        roundedBg: true,
      });
      const iconMaskable512 = renderLogoToSquarePng(img, 512, {
        paddingRatio: 0.14, // 14% safe-zone padding for Android adaptive maskable icons
        backgroundColor: '#FAF5F2',
        roundedBg: false,
      });

      const cachePayload: CachedPWAIcons = {
        sourceLogoUrl,
        siteName,
        primaryColor: themeColor,
        icon180,
        icon192,
        icon512,
        iconMaskable512,
      };

      try {
        localStorage.setItem(PWA_ICON_CACHE_KEY, JSON.stringify(cachePayload));
      } catch {
        // Ignore quota errors if storage is full
      }

      applyIconsAndManifestToDom({
        siteName,
        shortName,
        description,
        themeColor,
        icon180,
        icon192,
        icon512,
        iconMaskable512,
      });

      void updateCacheStorageIcons(cachePayload);
    } catch {
      // Fallback to direct logo URL if canvas tainting occurs
      applyIconsAndManifestToDom({
        siteName,
        shortName,
        description,
        themeColor,
        icon180: sourceLogoUrl,
        icon192: sourceLogoUrl,
        icon512: sourceLogoUrl,
        iconMaskable512: sourceLogoUrl,
      });
    }
  };

  img.onerror = () => {
    // Fallback if custom logo fails to load
    applyIconsAndManifestToDom({
      siteName,
      shortName,
      description,
      themeColor,
      icon180: '/apple-touch-icon.png',
      icon192: '/pwa-192x192.png',
      icon512: '/pwa-512x512.png',
      iconMaskable512: '/pwa-maskable-512x512.png',
    });
  };

  img.src = sourceLogoUrl;
}
