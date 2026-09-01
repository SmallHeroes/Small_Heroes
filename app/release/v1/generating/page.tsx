import { Suspense } from 'react';
import type { Metadata } from 'next';

import { SiteHeader } from '@/app/components/SiteHeader';
import { GeneratingClient } from '@/app/generating/generating-client';
import '@/app/landing/main.css';

export const metadata: Metadata = {
  title: 'גיבורים קטנים — מכינים את הספר שלכם',
  robots: { index: false },
};

export default function ReleaseV1GeneratingPage() {
  return (
    <>
      <SiteHeader variant="compact" />
      <Suspense fallback={null}>
        <GeneratingClient statusEndpoint="/api/release/v1/generate/status" />
      </Suspense>
    </>
  );
}
