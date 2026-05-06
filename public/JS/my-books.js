(function () {
  const ROUTES = globalThis.SH_ROUTES || { login: '/login' };
  const gridEl = document.getElementById('booksGrid');
  const subtitleEl = document.getElementById('booksSubtitle');
  const emptyEl = document.getElementById('booksEmpty');
  const logoutBtn = document.getElementById('logoutBtn');
  const STATUS_LABELS = {
    ready: 'מוכן לקריאה',
    generating: 'בהכנה...',
    partial: 'בהכנה חלקית',
    paid: 'ממתין ליצירה',
    failed: 'נכשל',
  };

  function createBookCard(book) {
    const card = document.createElement('article');
    card.className = 'book-card';

    const img = document.createElement('img');
    img.className = 'book-cover';
    img.alt = book.title || 'עטיפת ספר';
    img.src = book.coverImageUrl || '/Images/ExamplePage.png';
    card.appendChild(img);

    const body = document.createElement('div');
    body.className = 'book-card-body';

    const title = document.createElement('h3');
    title.className = 'book-card-title';
    title.textContent = book.title || `ספר עבור ${book.childName || 'הילד/ה'}`;
    body.appendChild(title);

    if (book.status !== 'ready') {
      const meta = document.createElement('div');
      meta.className = 'book-card-meta';
      meta.textContent = STATUS_LABELS[book.status] || book.status;
      body.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'book-card-actions';

    const openBtn = document.createElement('a');
    openBtn.className = 'btn-primary';
    openBtn.href = book.readyUrl;
    openBtn.textContent = 'פתיחת הספר';
    actions.appendChild(openBtn);

    if (book.pdfUrl) {
      const pdfBtn = document.createElement('a');
      pdfBtn.className = 'btn-outline';
      pdfBtn.href = book.pdfUrl;
      pdfBtn.textContent = 'PDF';
      pdfBtn.setAttribute('download', '');
      actions.appendChild(pdfBtn);
    }

    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  async function loadBooks() {
    const res = await fetch('/api/my-books', { credentials: 'include' }).catch(() => null);
    if (!res) {
      if (subtitleEl) subtitleEl.textContent = 'לא הצלחנו לטעון כרגע. נסו שוב.';
      return;
    }
    if (res.status === 401) {
      window.location.replace(ROUTES.login || '/login');
      return;
    }
    if (!res.ok) {
      if (subtitleEl) subtitleEl.textContent = 'שגיאה בטעינת החשבון.';
      return;
    }
    const data = await res.json();
    if (subtitleEl) subtitleEl.textContent = `מחוברים בתור ${data.user?.email || ''}`;
    const books = Array.isArray(data.books) ? data.books : [];
    if (!books.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    books.forEach((book) => {
      gridEl?.appendChild(createBookCard(book));
    });
  }

  logoutBtn?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    window.location.replace('/');
  });

  loadBooks();
})();
