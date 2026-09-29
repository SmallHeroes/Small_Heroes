import { PERSONAL_STORY_MOMENT as M } from '@/content/personal-landing';

/** A clearly labelled editorial illustration, never evidence of generated book quality. */
export function PersonalStoryMoment() {
  return <section id="personal-story-example" className="personal-story-example" aria-labelledby="personal-example-title">
    <div className="wrap">
      <p className="personal-example-kicker">{M.kicker}</p>
      <h2 id="personal-example-title" className="section-h2">{M.title}</h2>
      <div className="personal-example-layout">
        <aside className="personal-profile" aria-labelledby="personal-profile-title">
          <h3 id="personal-profile-title">{M.label}</h3>
          <ul>{M.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
          <p>פרופיל מומצא לצורך ההמחשה</p>
        </aside>
        <article className="personal-excerpt">
          <h3>{M.excerptTitle}</h3>
          <blockquote>{M.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</blockquote>
          <p className="personal-example-reflection">{M.reflection}</p>
        </article>
      </div>
      <p className="personal-example-disclosure">{M.disclosure}</p>
    </div>
  </section>;
}
