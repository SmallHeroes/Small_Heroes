import type { MvpMatrixCategoryPayload } from '@/lib/web/mvp-matrix-response';

/** Home/start category-card art per MVP category (public/Images/Categories). */
const CATEGORY_CARD_IMAGE: Record<string, string> = {
  NIGHT_FEAR: '/Images/Categories/StartUri.webp',
  SOCIAL: '/Images/Categories/StartAnat.webp',
  MEDICAL_PROCEDURE: '/Images/Categories/StartBuny.webp',
  NEW_SIBLING: '/Images/Categories/StartDuni.webp',
  TRANSITION: '/Images/Categories/StartKim.webp',
  ANGER_FRUSTRATION: '/Images/Categories/StartLeo.webp',
};

type CategoryChallengeCardProps = {
  slot: MvpMatrixCategoryPayload;
  as?: 'button' | 'article';
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  'data-event'?: string;
  'data-category'?: string;
  'data-reveal'?: string;
  'data-reveal-delay'?: string;
};

export function CategoryChallengeCard({
  slot,
  as = 'article',
  selected = false,
  disabled = false,
  onClick,
  className = '',
  ...dataAttrs
}: CategoryChallengeCardProps) {
  const companion = slot.companion;
  const classes = [
    'mvp-challenge-card',
    selected ? 'selected' : '',
    slot.publicVisible === false ? 'mvp-challenge-card--parked' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const companionLine = companion.name ? `עם ${companion.name}` : '';

  const cardImageSrc = CATEGORY_CARD_IMAGE[slot.category] ?? companion.image;
  const imageBlock = cardImageSrc ? (
    <img className="mvp-challenge-card-img" src={cardImageSrc} alt="" loading="lazy" />
  ) : (
    <span className="mvp-challenge-card-img mvp-challenge-card-img--placeholder" aria-hidden="true" />
  );

  const body = (
    <>
      <div className="mvp-challenge-card-img-wrap">{imageBlock}</div>
      <div className="mvp-challenge-card-text">
        <span className="mvp-challenge-card-label">{slot.label}</span>
        {companionLine ? (
          <span className="mvp-challenge-card-companion">{companionLine}</span>
        ) : null}
        <span className="mvp-challenge-card-oneliner">{slot.oneLiner}</span>
      </div>
      {slot.publicVisible === false ? (
        <span className="mvp-challenge-card-badge">dev</span>
      ) : null}
    </>
  );

  if (as === 'button') {
    return (
      <button
        type="button"
        className={classes}
        disabled={disabled || slot.publicVisible === false}
        onClick={onClick}
        data-category={slot.category}
        {...dataAttrs}
      >
        {body}
      </button>
    );
  }

  return (
    <article className={classes} data-category={slot.category} {...dataAttrs}>
      {body}
    </article>
  );
}
