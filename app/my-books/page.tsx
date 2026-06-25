import type { Metadata } from 'next';
import { SiteHeader } from '@/app/components/SiteHeader';
import { MyBooksClient } from './my-books-client';
import '../landing/main.css';

export const metadata: Metadata = {
  title: 'הספרים שלי — גיבורים קטנים',
  robots: { index: false },
};

export default function MyBooksPage() {
  return (
    <>
      <SiteHeader variant="full" />
      <MyBooksClient />
    </>
  );
}
