import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { fetchDriveFileBlobUrl } from '../services/apiClient';
import { getAccessToken } from '../services/firebaseAuth';

interface DriveImageProps {
  fileId?: string;
  fallbackUrl?: string;
  alt: string;
  className?: string;
  aspectClass?: string;
}

export function DriveImage({
  fileId,
  fallbackUrl,
  alt,
  className = 'w-full h-full object-cover',
  aspectClass = '',
}: DriveImageProps) {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(Boolean(fileId));
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setFailed(false);

    async function load() {
      if (!fileId) {
        if (fallbackUrl && !fallbackUrl.includes('drive.google.com/file')) {
          setSrc(fallbackUrl);
        }
        setLoading(false);
        return;
      }

      const token = getAccessToken();
      if (token) {
        setLoading(true);
        const blobUrl = await fetchDriveFileBlobUrl(fileId);
        if (active) {
          if (blobUrl) {
            setSrc(blobUrl);
            setLoading(false);
            return;
          }
        }
      }

      // Public Drive image fallback when unauthenticated visitor views published gallery
      if (active) {
        setSrc(`https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1200`);
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [fileId, fallbackUrl]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-teal-50/60 animate-pulse ${aspectClass} ${className}`}
        aria-label={`Memuat ${alt}`}
      >
        <ImageIcon className="w-6 h-6 text-teal-600/40" />
      </div>
    );
  }

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-teal-50 via-emerald-50/40 to-slate-100 text-teal-700/70 p-4 text-center ${aspectClass} ${className}`}
      >
        <ImageIcon className="w-7 h-7 stroke-[1.5]" />
        <span className="text-xs font-medium text-slate-600 line-clamp-2 max-w-[180px]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${aspectClass} ${className}`}
    />
  );
}
