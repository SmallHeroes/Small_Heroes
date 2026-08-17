import type { LandingContent } from '@/content/landing';

/**
 * "מאחורי גיבורים קטנים" — the human section between the quality band and
 * pricing, closing on the shared-language block (the old three-card
 * "approach" grid was replaced by it per Guy's copy spec).
 * Placeholder portraits live in /public/Images/about/ (swap the files or the
 * `img` paths in content/landing.ts for real photos — keep the aspect square).
 */
export function AboutSection({ about }: { about: LandingContent['about'] }) {
  return (
    <section className="section about-section" id="about">
      <div className="wrap">
        <h2 className="section-h2" data-reveal="up">{about.h2}</h2>
        <p className="section-lede" data-reveal="up" data-reveal-delay="40">{about.lede}</p>
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

        <div className="about-shared">
          <h3 className="about-shared-h3" data-reveal="up">{about.shared.h3}</h3>
          <p className="about-shared-lines" data-reveal="up" data-reveal-delay="60">{about.shared.text}</p>
          <p className="about-shared-note" data-reveal="fade" data-reveal-delay="120">{about.shared.note}</p>
        </div>
      </div>
    </section>
  );
}
