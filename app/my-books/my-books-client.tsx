'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ROUTES } from '@/lib/routes';
import styles from './my-books.module.css';

type BookEntry = {
  orderId?: string;
  title?: string | null;
  childName?: string;
  status: string;
  readyUrl: string;
  coverImageUrl?: string | null;
  companionName?: string | null;
  companionImage?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  ready: 'מוכן לקריאה',
  generating: 'בהכנה...',
  partial: 'בהכנה חלקית',
  paid: 'ממתין ליצירה',
  failed: 'נכשל',
};

function bookTitle(book: BookEntry) {
  return book.title || `ספר עבור ${book.childName || 'הילד/ה'}`;
}

function BookCard({ book }: { book: BookEntry }) {
  const title = bookTitle(book);
  const isReady = book.status === 'ready';
  const companionLine = book.childName
    ? `${book.childName} וחברים`
    : book.companionName
      ? `עם ${book.companionName}`
      : null;

  const content = (
    <>
      <img
        className={styles.cover}
        src={book.coverImageUrl || '/Images/ExamplePage.png'}
        alt={title}
      />
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        {book.companionName && companionLine ? (
          <div className={styles.companion}>
            {book.companionImage ? (
              <img className={styles.companionImg} src={book.companionImage} alt="" loading="lazy" />
            ) : null}
            <span>{companionLine}</span>
          </div>
        ) : null}
        {!isReady ? (
          <div className={styles.meta}>{STATUS_LABELS[book.status] || book.status}</div>
        ) : null}
      </div>
    </>
  );

  if (isReady) {
    return (
      <Link
        href={book.readyUrl}
        className={`${styles.card} ${styles.cardReady}`}
        aria-label={`פתיחת הספר ${title}`}
      >
        {content}
      </Link>
    );
  }

  return <article className={styles.card}>{content}</article>;
}

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
          {books.map((book) => (
            <BookCard key={book.orderId || book.readyUrl} book={book} />
          ))}
        </section>
      )}
    </main>
  );
}
