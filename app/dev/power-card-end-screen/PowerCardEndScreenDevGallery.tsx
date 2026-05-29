'use client';

import { useState } from 'react';
import { PowerCardEndScreen } from '@/app/book/[id]/read-v2/components/PowerCardEndScreen';
import type { PowerCardRenderInput } from '@/lib/power-cards/types';
import readerStyles from '@/app/book/[id]/read-v2/reader-v2.module.css';

export type PowerCardEndScreenDevSample = {
  label: string;
  input: PowerCardRenderInput;
};

type Props = {
  samples: PowerCardEndScreenDevSample[];
};

export function PowerCardEndScreenDevGallery({ samples }: Props) {
  const [continued, setContinued] = useState<Record<string, boolean>>({});

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 32,
        alignItems: 'start',
      }}
    >
      {samples.map(({ label, input }) => (
        <section key={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#6b5f52' }}>{label}</h2>
          <div
            className={readerStyles.root}
            style={{
              minHeight: 'min(90vh, 820px)',
              borderRadius: 12,
              border: '1px solid rgba(92, 83, 72, 0.15)',
              overflow: 'hidden',
            }}
          >
            {continued[label] ? (
              <section className={readerStyles.centerState}>
                <div className={readerStyles.endGlyph}>✦</div>
                <h2 className={readerStyles.endTitle}>סיימת! לקרוא שוב?</h2>
                <button
                  type="button"
                  className={readerStyles.controlBtn}
                  onClick={() => setContinued((prev) => ({ ...prev, [label]: false }))}
                >
                  חזרה לכרטיס
                </button>
              </section>
            ) : (
              <PowerCardEndScreen
                orderId="dev-power-card-end-screen"
                accessKey="dev-preview-only"
                childName={input.childName}
                powerCard={input}
                onContinue={() => setContinued((prev) => ({ ...prev, [label]: true }))}
              />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
