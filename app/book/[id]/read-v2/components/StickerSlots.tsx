import styles from '../reader-v2.module.css';

const SLOT_NAMES = [
  'corner-top-left',
  'corner-top-right',
  'corner-bottom-left',
  'corner-bottom-right',
  'gutter-side',
  'text-margin-right',
] as const;

type Props = {
  variant: 'desktop' | 'mobile';
};

/** Phase 1: empty DOM slots for future companion stickers — zero layout footprint. */
export function StickerSlots({ variant }: Props) {
  return (
    <>
      {SLOT_NAMES.map((name) => {
        if (variant === 'desktop' && name === 'text-margin-right') return null;
        if (variant === 'mobile' && name === 'gutter-side') return null;
        return (
          <div
            key={name}
            className={styles.stickerSlot}
            data-slot={name}
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}
