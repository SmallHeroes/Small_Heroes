'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import styles from './admin-gate.module.css';

const STORAGE_KEY = 'sh_admin_generation_secret';

export function readStoredAdminSecret(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeAdminSecret(secret: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, secret);
  } catch {
    /* ignore */
  }
}

export function clearAdminSecret(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type Props = {
  children: (secret: string) => ReactNode;
};

/** Client gate: operator pastes GENERATION_SECRET once per tab session. */
export function AdminSecretGate({ children }: Props) {
  const [secret, setSecret] = useState('');
  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSecret(readStoredAdminSecret());
    setReady(true);
  }, []);

  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    if (!next) return;
    storeAdminSecret(next);
    setSecret(next);
  }, [draft]);

  const onClear = useCallback(() => {
    clearAdminSecret();
    setSecret('');
    setDraft('');
  }, []);

  if (!ready) {
    return <div className={styles.gateShell}>טוען…</div>;
  }

  if (!secret) {
    return (
      <div className={styles.gateShell}>
        <form className={styles.gateCard} onSubmit={onSubmit}>
          <h1 className={styles.gateTitle}>כניסת מפעיל</h1>
          <p className={styles.gateHint}>
            הזינו את מפתח הניהול (`GENERATION_SECRET`) — אותו שער כמו שאר נתיבי ה־admin.
          </p>
          <label className={styles.gateLabel} htmlFor="admin-secret">
            מפתח
          </label>
          <input
            id="admin-secret"
            className={styles.gateInput}
            type="password"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="••••••••"
          />
          <button type="submit" className={styles.gateBtn} disabled={!draft.trim()}>
            כניסה
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.authedShell}>
      <div className={styles.authedBar}>
        <span className={styles.authedLabel}>מחוברים כמפעיל</span>
        <button type="button" className={styles.logoutBtn} onClick={onClear}>
          יציאה
        </button>
      </div>
      {children(secret)}
    </div>
  );
}
