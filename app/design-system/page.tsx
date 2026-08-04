import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import DesignSystemClient from './ds-client';
import '../landing/main.css';
import '../landing/landing.css';
import '../landing/motion.css';
import '../category-challenge-card.css';
import './ds.css';

export const metadata: Metadata = {
  title: 'Design System — גיבורים קטנים (internal)',
  robots: { index: false, follow: false },
};

/**
 * Internal design-system showcase — renders the REAL tokens (public/CSS/tokens.css,
 * global via app/layout.tsx) and the real production classes/components, so the page
 * cannot drift from the product. Dev-only: same guard as /dev/*.
 */
export default function DesignSystemPage() {
  if (!isDevEnvironment()) {
    notFound();
  }
  return <DesignSystemClient />;
}
