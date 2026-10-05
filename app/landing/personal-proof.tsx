import { PERSONAL_PROOF as P } from '@/content/personal-landing';

/**
 * The preview's proof, straight after the hero (site audit 2026-10-01): what a parent told us, and what it
 * changed in the story. The parent's words keep the hero's hand and its stickers; the story is an open book
 * with Yuval's approved picture. Labelled as a hand-written example, not engine output.
 */
export function PersonalProof() {
  return (
    <section id="example" className="personal-proof" aria-labelledby="personal-proof-title">
      <div className="wrap">
        <p className="personal-kicker">{P.kicker}</p>
        <h2 id="personal-proof-title" className="section-h2">{P.title}</h2>
        <p className="section-lede">{P.lede}</p>

        <div className="pp-grid">
          <div className="pp-told" data-reveal="up" data-reveal-delay="80">
            <h3 className="pp-label">{P.toldLabel}</h3>
            <blockquote className="pp-bubble">
              {P.told.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </blockquote>

            <h3 className="pp-label">{P.linksLabel}</h3>
            <ul className="pp-links">
              {P.links.map((link) => (
                <li key={link.detail}>
                  <span className="pp-tag">{link.detail}</span>
                  <span className="pp-into" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" focusable="false">
                      <path d="M19 12H5" />
                      <path d="M11 6l-6 6 6 6" />
                    </svg>
                  </span>
                  <span className="pp-became">{link.story}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* an open book (Guy 2026-10-05): two pages of one size, the words on the reading-side page and
              Yuval's picture facing them, in a cover with the binding's shadow between them */}
          <article className="pp-book" data-reveal="up" data-reveal-delay="200" aria-labelledby="personal-proof-story">
            <div className="pp-spread">
              <div className="pp-leaf pp-leaf--words">
                <h3 id="personal-proof-story" className="pp-running">{P.storyLabel}</h3>
                {P.story.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <div className="pp-leaf pp-leaf--art">
                <img className="pp-art" src={P.image} alt={P.imageAlt} width={610} height={910} loading="lazy" decoding="async" />
              </div>
            </div>
          </article>
        </div>

        <p className="pp-note">{P.note}</p>
      </div>
    </section>
  );
}
