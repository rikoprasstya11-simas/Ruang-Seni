import { fetchDriveFileBlobUrl } from '../services/apiClient';
import { getAccessToken } from '../services/firebaseAuth';

const DEFAULT_FAVICON = '/favicon.svg';

function setFaviconHref(href: string) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;

  let appleLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
  if (!appleLink) {
    appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    document.head.appendChild(appleLink);
  }
  appleLink.href = href;
}

export async function syncFaviconWithLogo(
  logoFileId?: string,
  logoUrl?: string,
  siteName?: string
) {
  if (typeof document === 'undefined') return;

  if (siteName && siteName.trim()) {
    document.title = `${siteName.trim()} — Administrasi Guru & Galeri Karya Seni Budaya SMP`;
  }

  if (!logoFileId) {
    if (logoUrl && !logoUrl.includes('drive.google.com/file')) {
      setFaviconHref(logoUrl);
    } else {
      setFaviconHref(DEFAULT_FAVICON);
    }
    return;
  }

  const token = getAccessToken();
  if (token) {
    const blobUrl = await fetchDriveFileBlobUrl(logoFileId);
    if (blobUrl) {
      setFaviconHref(blobUrl);
      return;
    }
  }

  setFaviconHref(`https://lh3.googleusercontent.com/d/${encodeURIComponent(logoFileId)}=s128`);
}
