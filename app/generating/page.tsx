import { Suspense } from 'react';
import type { Metadata } from 'next';
import { GeneratingClient } from './generating-client';
import '../landing/main.css';

export const metadata: Metadata = {
  title: 'גיבורים קטנים — מכינים את הספר שלכם',
  robots: { index: false },
};

export default function GeneratingPage() {
  /* No site chrome: the waiting scene owns the whole viewport (per Guy).
     The scene itself carries a quiet way back home. */
  return (
    <Suspense fallback={null}>
      <GeneratingClient />
    </Suspense>
  );
}
