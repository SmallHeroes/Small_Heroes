import type { Metadata } from 'next';
import { buildMvpMatrixResponse } from '@/lib/web/mvp-matrix-response';
import StartClient from './start-client';
import '../landing/main.css';
import '../category-challenge-card.css';

export const metadata: Metadata = {
  title: 'בחרו אתגר — גיבורים קטנים',
  description: 'בחרו את האתגר הרגשי של הילד/ה ואת סוג החוויה — ונתחיל לבנות ספר אישי.',
};

export default function StartPage() {
  const matrix = buildMvpMatrixResponse();

  return (
    <StartClient
      headerTitle={matrix.header.title}
      headerSub={matrix.header.sub}
      categories={matrix.categories}
    />
  );
}
