'use client';

import { useCallback, useState } from 'react';
import { illustrationLoadingAttr } from '@/lib/book-layout';
import styles from '../reader-v2.module.css';

type Props = {
  url: string | null;
  alt: string;
  isCurrent: boolean;
  className?: string;
  wide?: boolean;
};

export function SceneIllustration({ url, alt, isCurrent, className, wide }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    url ? 'loading' : 'error'
  );
  const [retryNonce, setRetryNonce] = useState(0);

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

  return (
    <div className={`${styles.illustrationFrame} ${wide ? styles.illustrationWide : ''} ${className ?? ''}`}>
      {status === 'loading' ? <div className={styles.illustrationShimmer} aria-hidden /> : null}
      <img
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
