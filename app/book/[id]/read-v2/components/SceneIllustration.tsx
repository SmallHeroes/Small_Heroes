'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { illustrationLoadingAttr } from '@/lib/book-layout';
import { getReaderImageCacheState } from '../useAdjacentImagePreload';
import styles from '../reader-v2.module.css';

type Props = {
  url: string | null;
  alt: string;
  isCurrent: boolean;
  className?: string;
  wide?: boolean;
};

function initialIllustrationStatus(url: string | null): 'idle' | 'loading' | 'loaded' | 'error' {
  if (!url) return 'error';
  return getReaderImageCacheState(url) === 'loaded' ? 'loaded' : 'loading';
}

export function SceneIllustration({ url, alt, isCurrent, className, wide }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(() =>
    initialIllustrationStatus(url)
  );
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!url) {
      setStatus('error');
      return;
    }
    if (getReaderImageCacheState(url) === 'loaded') {
      setStatus('loaded');
      return;
    }
    setStatus('loading');
  }, [url, retryNonce]);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || !url) return;
    if (img.complete && img.naturalWidth > 0) {
      setStatus('loaded');
    }
  }, [url, retryNonce]);

  const retry = useCallback(() => {
    if (!url) return;
    setRetryNonce((n) => n + 1);
    setStatus('loading');
  }, [url]);

  if (!url || status === 'error') {
    return (
      <div className={`${styles.illustrationPlaceholder} ${className ?? ''}`} role="img" aria-label={alt}>
        <p className={styles.illustrationPlaceholderMsg}>האיור עדיין נטען...</p>
        {url ? (
          <button type="button" className={styles.illustrationRetryBtn} onClick={retry}>
            נסו שוב
          </button>
        ) : null}
      </div>
    );
  }

  const showShimmer = status === 'loading';

  return (
    <div className={`${styles.illustrationFrame} ${wide ? styles.illustrationWide : ''} ${className ?? ''}`}>
      {showShimmer ? <div className={styles.illustrationShimmer} aria-hidden /> : null}
      <img
        ref={imgRef}
        key={`${url}-${retryNonce}`}
        src={url}
        alt={alt}
        className={`${styles.illustrationImg} ${status === 'loaded' ? styles.illustrationImgLoaded : ''}`}
        loading={illustrationLoadingAttr(isCurrent)}
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
}
