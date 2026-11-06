# Environment

**What belongs here:** Required env vars, external dependencies, setup notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

- No database or external services needed
- All persistence is in-memory via module-level data structures in `server/data/`
- Data resets on server restart (acceptable for pre-production)
- Running on Vercel for preview deployments
