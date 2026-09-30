import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';

/**
 * An attachment image. Files need the signed-in user's token, which a plain
 * <img src> can't send, so the image is fetched as a blob.
 */
const AuthImage: React.FC<{
  fileId: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}> = ({ fileId, alt, className = '', onClick }) => {
  const [src, setSrc] = useState<string>('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url = '';
    let cancelled = false;
    apiService
      .downloadFile(fileId)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-xs text-gray-500 ${className}`}
      >
        Preview unavailable
      </div>
    );
  }
  if (!src) return <div className={`animate-pulse bg-gray-200 ${className}`} />;
  return (
    <img
      src={src}
      alt={alt}
      onClick={onClick}
      className={`${className} ${onClick ? 'cursor-zoom-in' : ''}`}
    />
  );
};

export default AuthImage;
