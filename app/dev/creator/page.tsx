import { notFound } from 'next/navigation';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import { CreatorPanel } from './CreatorPanel';
import '../../landing/main.css';

export default function DevCreatorPage() {
  if (!isDevEnvironment()) {
    notFound();
  }
  return <CreatorPanel />;
}
