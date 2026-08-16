import type { LandingContent } from '@/content/landing';

/* Minimal line icons for the approach cards — same 1.7-stroke language as TRUST_ICONS.
   Order matches L.about.approach.cards: naming · capability · conversation. */
const APPROACH_ICONS = [
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.3c0 3.9-4 7-9 7-1 0-2-.12-2.9-.35L4 19.6l1.2-3.2C3.8 15.1 3 13.3 3 11.3c0-3.9 4-7 9-7s9 3.1 9 7z" />
      <path d="M8.6 11.3h.01M12 11.3h.01M15.4 11.3h.01" />
    </svg>
  ),
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.6l2.1 4.9 5.3.5-4 3.6 1.2 5.2L12 15l-4.6 2.8 1.2-5.2-4-3.6 5.3-.5L12 3.6z" />
    </svg>
  ),
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20.4S4 15.3 4 9.9C4 7.2 6 5.4 8.3 5.4c1.5 0 2.9.8 3.7 2 .8-1.2 2.2-2 3.7-2C18 5.4 20 7.2 20 9.9c0 5.4-8 10.5-8 10.5z" />
    </svg>
  ),
];

/**
 * "מי מאחורי זה" + "הגישה שלנו" — trust section between the product-trust band and pricing.
 * Bright/creamy, clean, no clinic-feel. Placeholder portraits live in /public/Images/about/
 * (swap the files or the `img` paths in content/landing.ts for real photos — keep the aspect square).
 */
export function AboutSection({ about }: { about: LandingContent['about'] }) {
  return (
    <section className="section about-section" id="about">
      <div className="wrap">
        <h2 className="section-h2" data-reveal="up">{about.h2}</h2>
        <p className="section-lede" data-reveal="up" data-reveal-delay="40">
          {about.ledeLine1}
          <br />
          {about.ledeLine2}
        </p>
        <p className="about-intro" data-reveal="up" data-reveal-delay="80">{about.intro}</p>
        <p className="about-belief" data-reveal="up" data-reveal-delay="120">{about.belief}</p>

        <div className="about-people">
          {about.people.map((person, i) => (
            <article key={person.name} className="about-person" data-reveal="up" data-reveal-delay={String(140 + i * 90)}>
              <div className="about-portrait-ring">
                <img
                  src={person.img}
                  alt={`${person.name} — ${person.role}`}
                  className="about-portrait"
                  loading="lazy"
                />
              </div>
              <h3 className="about-name">{person.name}</h3>
              <span className="about-role">{person.role}</span>
              <p className="about-bio">{person.bio}</p>
            </article>
          ))}
        </div>

        <p className="about-tech-line" data-reveal="fade" data-reveal-delay="160">{about.techLine}</p>

        <div className="about-approach">
          <h3 className="about-approach-h3" data-reveal="up">{about.approach.h3}</h3>
          <p className="about-approach-p" data-reveal="up" data-reveal-delay="60">{about.approach.p}</p>
          <div className="about-approach-grid">
            {about.approach.cards.map((card, i) => (
              <article key={card.title} className="about-approach-card" data-reveal="up" data-reveal-delay={String(100 + i * 80)}>
                <span className="about-approach-icon" aria-hidden="true">{APPROACH_ICONS[i]}</span>
                <h4 className="about-approach-title">{card.title}</h4>
                <p className="about-approach-body">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
