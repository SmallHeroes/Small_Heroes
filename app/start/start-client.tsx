'use client';

import { CategoryChallengeCard } from '@/app/category-challenge-card';
import { SiteHeader } from '@/app/components/SiteHeader';
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
      <SiteHeader variant="full" />

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
