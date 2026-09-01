'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { illustrationLoadingAttr } from '@/lib/book-layout';
import {
  decodeReaderImage,
  getReaderImageCacheState,
  recordReaderImageError,
  resetReaderImageCacheUrl,
} from '../useAdjacentImagePreload';
import styles from '../reader-v2.module.css';

type Props = {
  url: string | null;
  alt: string;
  isCurrent: boolean;
  className?: string;
  wide?: boolean;
};

type IllustrationStatus = 'loading' | 'loaded' | 'error';

type IllustrationState = {
  url: string | null;
  retryNonce: number;
  status: IllustrationStatus;
};

function initialIllustrationStatus(url: string | null): IllustrationStatus {
  if (!url) return 'error';
  return getReaderImageCacheState(url) === 'decoded' ? 'loaded' : 'loading';
}

export function SceneIllustration({ url, alt, isCurrent, className, wide }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [illustrationState, setIllustrationState] = useState<IllustrationState>(() => ({
    url,
    retryNonce: 0,
    status: initialIllustrationStatus(url),
  }));
  const status = illustrationState.url === url && illustrationState.retryNonce === retryNonce
    ? illustrationState.status
    : initialIllustrationStatus(url);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || !url) return;
    let cancelled = false;
    if (!img.complete || img.naturalWidth <= 0) return;
    void decodeReaderImage(url, img).then((decoded) => {
      if (cancelled || imgRef.current !== img) return;
      setIllustrationState({
        url,
        retryNonce,
        status: decoded ? 'loaded' : 'error',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [url, retryNonce]);

  const retry = useCallback(() => {
    if (!url) return;
    resetReaderImageCacheUrl(url);
    setRetryNonce((n) => n + 1);
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
        onLoad={(event) => {
          const image = event.currentTarget;
          if (imgRef.current !== image) return;
          setIllustrationState({ url, retryNonce, status: 'loading' });
          void decodeReaderImage(url, image).then((decoded) => {
            if (imgRef.current !== image) return;
            setIllustrationState({
              url,
              retryNonce,
              status: decoded ? 'loaded' : 'error',
            });
          });
        }}
        onError={(event) => {
          const image = event.currentTarget;
          if (imgRef.current !== image) return;
          recordReaderImageError(url, image);
          setIllustrationState({ url, retryNonce, status: 'error' });
        }}
      />
    </div>
  );
}
