'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ROUTES } from '@/lib/routes';
import styles from './my-books.module.css';

type BookEntry = {
  title?: string;
  childName?: string;
  status: string;
  readyUrl: string;
  pdfUrl?: string | null;
  coverImageUrl?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  ready: 'מוכן לקריאה',
  generating: 'בהכנה...',
  partial: 'בהכנה חלקית',
  paid: 'ממתין ליצירה',
  failed: 'נכשל',
};

export function MyBooksClient() {
  const [subtitle, setSubtitle] = useState('טוענים את הספרים שלכם...');
  const [books, setBooks] = useState<BookEntry[]>([]);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/my-books', { credentials: 'include' }).catch(() => null);
      if (cancelled) return;
      if (!res) {
        setSubtitle('לא הצלחנו לטעון כרגע. נסו שוב.');
        return;
      }
      if (res.status === 401) {
        window.location.replace(ROUTES.login);
        return;
      }
      if (!res.ok) {
        setSubtitle('שגיאה בטעינת החשבון.');
        return;
      }
      const data = await res.json();
      setSubtitle(`מחוברים בתור ${data.user?.email || ''}`);
      const list = Array.isArray(data.books) ? (data.books as BookEntry[]) : [];
      setBooks(list);
      setEmpty(!list.length);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.main}>
      <section className={styles.head}>
        <h1>הספרים שלי</h1>
        <p>{subtitle}</p>
      </section>

      {empty ? (
        <div className={styles.empty}>עדיין לא נוצרו ספרים בחשבון הזה.</div>
      ) : (
        <section className={styles.grid}>
          {books.map((book, index) => (
            <article key={`${book.readyUrl}-${index}`} className={styles.card}>
              <img
                className={styles.cover}
                src={book.coverImageUrl || '/Images/ExamplePage.png'}
                alt={book.title || 'עטיפת ספר'}
              />
              <div className={styles.body}>
                <h3>{book.title || `ספר עבור ${book.childName || 'הילד/ה'}`}</h3>
                {book.status !== 'ready' ? (
                  <div className={styles.meta}>{STATUS_LABELS[book.status] || book.status}</div>
                ) : null}
                <div className={styles.actions}>
                  <Link href={book.readyUrl} className={styles.primaryBtn}>
                    פתיחת הספר
                  </Link>
                  {book.pdfUrl ? (
                    <a href={book.pdfUrl} className={styles.outlineBtn} download>
                      PDF
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
