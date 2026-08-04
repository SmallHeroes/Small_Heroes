import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import { HeroExperiment } from './HeroExperiment';
import '../../../public/CSS/tokens.css';

export const metadata: Metadata = {
  title: 'ניסוי הירו — גיבורים קטנים (dev)',
  robots: { index: false, follow: false },
};

/**
 * EXPERIMENT (R&D, not production): immersive homepage hero prototype —
 * "the book opens for your child". Isolated dev route; the production
 * landing hero is untouched. Concept selection + evaluation in
 * _review/hero-reader-rnd/REPORT.md.
 */
export default function HeroExperimentPage() {
  if (!isDevEnvironment()) {
    notFound();
  }
  return <HeroExperiment />;
}
