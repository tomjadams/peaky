# Change: Add Documentation Site with Zensical

## Why

The project lacks unified documentation that serves three audiences:
1. **Potential users** - Landing page showcasing features, screenshots, value proposition
2. **Current users** - User guide explaining how to use the product
3. **Maintainers** - Internal docs (decision log, domain model, architecture, development guides)

Currently:
- Marketing/landing page: None
- User guide: None  
- Internal docs: Scattered in `docs/` folder, not published anywhere

## What Changes

- Install Zensical (static site generator) via `uv`
- Create documentation site structure with three sections:
  - **Landing page** - Hero, features, screenshots (marketing)
  - **User Guide** - How to use ORR (end-user documentation)
  - **Maintainers** - Decision log, domain model, architecture, development (internal)
- Theme using existing ORR branding (indigo primary, dark/light mode)
- Include screenshots from `screenshots/` folder for marketing/showcase
- Migrate existing `docs/` content into the new structure

**Documentation structure:**
```
site/                          # Zensical site root
├── docs/
│   ├── index.md               # Landing page (hero, features, screenshots)
│   ├── user-guide/
│   │   ├── getting-started.md
│   │   ├── applications.md
│   │   ├── reviews.md
│   │   ├── templates.md
│   │   └── survey-mode.md
│   └── maintainers/
│       ├── index.md           # Overview for new maintainers
│       ├── domain.md          # Domain model (from docs/domain.md)
│       ├── decisions.md       # Decision log (from docs/decisions/)
│       ├── architecture.md    # System architecture
│       └── development/
│           ├── setup.md
│           ├── frontend.md
│           ├── backend.md
│           └── testing.md
├── zensical.toml              # Site configuration
└── assets/
    └── images/                # Screenshots for landing page
```

## Impact

- Affected specs: New `documentation` capability
- New files: `site/` directory with Zensical structure
- New dev dependency: `zensical` (via uv)
- Existing `docs/` content will be migrated (not deleted, referenced)
