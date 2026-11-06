# Product Documentation Review Context

## Scope

Apply this context to `site/docs/user-guide/**`, `site/docs/roadmap.md`, and
`site/docs/product_changelog.md`.

The audience includes PMs and TPMs, executives, compliance leads, engineers
using the product, and template authors. Assume no engineering background even
when documenting power-user workflows.

## Project invariants

- Peaky speaks in first-person plural with casual, direct, conversational
  authority: "we call them Advisors", "Hit refresh", and "Don't ignore it".
- Product documentation explains outcomes, not implementation. Terms such as
  OPFS, Drizzle, Zod, service workers, schema migrations, and endpoints do not
  belong on a healthy user path.
- The product mental model is **Define, Review, Learn, Act**. Templates set the
  readiness bar; teams own reviews and gaps; assessors answer; Advisors provide
  a second pair of eyes and transfer knowledge.
- Product docs preserve Peaky's domain language: templates, pillars, questions,
  products, teams, reviews, assessments, gaps, assessors, and Advisors.
- Examples may cover engineering readiness, compliance, process maturity, or
  business initiatives. They are scenarios, not prescribed organizational
  rules.
- Healthy states hide internal versions, IDs, migration counts, and storage
  details. Say "Up to date" when that is the user-relevant truth.

## Project conventions

- Use a lead-and-stop opening: short introduction, useful hero screenshot,
  one-line reason it matters, then an explicit off-ramp for readers who have
  enough.
- Put explanatory context before every screenshot. Screenshots must teach
  something prose alone cannot.
- Screenshot pairs live under `site/docs/assets/images/` and use a `-dark`
  filename plus `#only-light` and `#only-dark` rendering suffixes. Mention dark
  mode once per page.
- Use full-page heroes and targeted card or tile shots next to the relevant
  explanation.
- Use numbered prose for sequential concepts and concise, question-shaped
  admonition titles. Never stack two admonitions without prose between them.
- Troubleshooting uses arrow questions such as
  `Past 80%? → Archive a few reviews.`.
- Use `<div class="grid cards" markdown>` for three or more navigation choices.
  Use paired `health-cards` for good-versus-trouble comparisons.
- Introduce tables in prose. Prefer concrete scenarios and include when a user
  would choose each option, not only the button sequence.

## Deterministic coverage

- `site/docs/user-guide/index.md`: preserve the Define, Review, Learn, Act model,
  domain glossary, and audience-specific start cards.
- Task guides: verify the first screenful gives the shortest successful path
  and a clear stopping point.
- Power-user guides: keep implementation details hidden while retaining useful
  shortcuts, advanced modes, and operational consequences.
- Screenshots: verify referenced light and dark assets exist and match the
  described state.
- Healthy, warning, and recovery copy: expose what the member should understand
  or do, not internal storage or sync mechanics.
- Examples: ensure they are clearly illustrative and apply beyond peak-season
  engineering scenarios where the feature is domain-neutral.

## References

- `site/docs/user-guide/index.md`
- `site/docs/user-guide/assessor-quickstart.md`
- `site/docs/user-guide/product-tour.md`
- `site/docs/user-guide/authoring-templates.md`
- `site/docs/user-guide/power-user/`
- `site/docs/assets/images/`
- `site/docs/roadmap.md`
- `site/docs/product_changelog.md`
