import { notFound } from 'next/navigation';
import { CreatorPanel } from './CreatorPanel';

export default function DevCreatorPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <CreatorPanel />;
}
