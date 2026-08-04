import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import { FlipBook } from './FlipBook';
import '../../../public/CSS/tokens.css';

export const metadata: Metadata = {
  title: 'ניסוי דפדוף — גיבורים קטנים (dev)',
  robots: { index: false, follow: false },
};

/**
 * EXPERIMENT (R&D, not production): RTL physical page-turn prototype.
 * Isolated dev route — the production reader (/book/[id]/read-v2) is untouched.
 * Sample content: real approved bank story + real product assets (see sample-story.ts).
 */
export default function ReaderFlipExperimentPage() {
  if (!isDevEnvironment()) {
    notFound();
  }
  return <FlipBook />;
}
