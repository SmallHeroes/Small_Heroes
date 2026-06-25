import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SiteHeader } from '@/app/components/SiteHeader';
import { GeneratingClient } from './generating-client';
import '../landing/main.css';

export const metadata: Metadata = {
  title: 'גיבורים קטנים — מכינים את הספר שלכם',
  robots: { index: false },
};

export default function GeneratingPage() {
  return (
    <>
      <SiteHeader variant="compact" />
      <Suspense fallback={null}>
        <GeneratingClient />
      </Suspense>
    </>
  );
}
