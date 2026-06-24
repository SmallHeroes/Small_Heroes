'use client';

import Link from 'next/link';
import { CategoryChallengeCard } from '@/app/category-challenge-card';
import { COMMON } from '@/content';
import type { MvpMatrixCategoryPayload } from '@/lib/web/mvp-matrix-response';
import styles from './start.module.css';

type StartClientProps = {
  headerTitle: string;
  headerSub: string;
  categories: MvpMatrixCategoryPayload[];
};

export default function StartClient({ headerTitle, headerSub, categories }: StartClientProps) {
  function handoffToWizard(category: string) {
    const params = new URLSearchParams({ category });
    window.location.href = `/wizard?${params.toString()}`;
  }

  return (
    <div className={styles.root}>
      <header className={styles.navbar}>
        <div className={styles.navbarInner}>
          <Link href="/" className={styles.logo} aria-label={COMMON.brand}>
            <div className={styles.logoIcon}>
              <div className={styles.logoIconSq} />
              <div className={styles.logoIconDot} />
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoBrand}>{COMMON.brand}</span>
              <span className={styles.logoTagline}>{COMMON.tagline}</span>
            </div>
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className={[styles.shell, styles.shellWide].join(' ')}>
          <div className={styles.intro}>
            <h1 className={styles.title}>{headerTitle}</h1>
            <p className={styles.sub}>{headerSub}</p>
          </div>
          <div className={styles.challengeWrap}>
            <div className="mvp-challenge-grid mvp-challenge-grid--start">
              {categories.map((slot) => (
                <CategoryChallengeCard
                  key={slot.category}
                  slot={slot}
                  as="button"
                  onClick={() => handoffToWizard(slot.category)}
                  data-event="start_challenge_select"
                  data-category={slot.category}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
