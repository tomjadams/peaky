## ADDED Requirements

### Requirement: <!-- requirement name -->

<!-- requirement text using SHALL/MUST for normative requirements -->
**ID:** REQ-NNN

#### Scenario: <!-- scenario name -->

- **WHEN** <!-- condition -->
- **THEN** <!-- expected outcome -->
- **ID:** AC-NNN

## MODIFIED Requirements

### Requirement: <!-- requirement name -->

<!-- Full updated content - copy entire requirement block from existing spec, keeping its **ID:** line -->

#### Scenario: <!-- scenario name -->

- **WHEN** <!-- condition -->
- **THEN** <!-- expected outcome -->
- **ID:** AC-NNN

## REMOVED Requirements

### Requirement: <!-- requirement name -->

**Reason**: <!-- why it's being removed -->
**Migration**: <!-- how to migrate -->
**ID:** REQ-NNN

---

<!--
PROMPT GUIDANCE FOR AI:

Create one spec file per capability/feature area in specs/<name>/spec.md.

Format requirements:
- Each requirement: ### Requirement: <name> followed by description
- Use SHALL/MUST for normative requirements (avoid should/may)
- Each scenario: #### Scenario: <name> with WHEN/THEN format
- CRITICAL: Scenarios MUST use exactly 4 hashtags (####)
- Every requirement MUST have at least one scenario

Traceability IDs (REQ-NNN / AC-NNN):
- IDs live in the BODY, never in the header — this keeps the `### Requirement:` /
  `#### Scenario:` header text byte-identical to what OpenSpec parses and archive-
  matches by, so IDs add traceability WITHOUT changing how requirements are matched.
- PLACEMENT MATTERS (verified against `openspec validate --strict`): OpenSpec reads
  the FIRST line under a requirement header as the SHALL/MUST statement. So:
  - `**ID:** REQ-NNN` goes on the line AFTER the requirement statement (never before it).
  - `- **ID:** AC-NNN` goes as the LAST scenario bullet, AFTER WHEN/THEN.
  Putting the ID first makes the SHALL check fail ("must contain SHALL or MUST").
- Assign a stable ID to every requirement and every scenario (the scenario is the
  acceptance criterion). New IDs are scoped to the OpenSpec change name:
  `REQ-<change-name>-001` and `AC-<change-name>-001`. REQ and AC sequences are
  independent and continue across every capability file in the change.
- Use the concrete change name from `openspec/changes/<change-name>/`; never write the
  literal `<change-name>`, `REQ-NNN`, or `AC-NNN`. Pre-commit rejects placeholders
  with the exact ID required, but writing the final form keeps later artifacts coherent.
- IDs are PERMANENT — never renumber them when prose or headings change. Once a
  change has allocated an ID, its change name is also immutable and must never be
  reused after archive; that namespace prevents concurrent branches from colliding.
- A MODIFIED or REMOVED requirement keeps its live REQ ID. Existing scenarios keep
  their AC IDs; only scenarios introduced by the current change receive its namespace.
- `openspec validate` does not check IDs. `pnpm openspec:ids` does, and reports the
  exact correction for missing, placeholder, conflicting, or malformed IDs.
- Cite IDs as `<capability>:<ID>` outside the spec, including tasks and formal models.
  The capability qualifier keeps legacy numeric IDs unambiguous while stable IDs let
  outcome review and model-based testing prove coverage without fuzzy text matching.

Closure gate (before finalising the spec):
- Every scenario must be UNAMBIGUOUS (one reading), use a VERIFIABLE verb
  (returns/rejects/renders/persists — not supports/handles/improves), and assert a
  MEASURABLE outcome a test could check. A scenario that fails this is not done —
  tighten it or log the open question. Vague acceptance criteria pass review and fail
  in production.

Implicit-requirement sweep (catch the dimensions models silently drop):
- Before finalising, walk these nine dimensions and add requirements/scenarios for any
  that apply: input validation · failure states · idempotency · authorization ·
  concurrency · data lifecycle (retention/deletion/migration) · observability ·
  external-dependency handling (timeouts/retries) · state transitions.
- Scope the sweep to the change: large/complex changes cover all nine explicitly;
  medium changes address the obviously-relevant ones; small (≤3 file) changes may skip
  it. Security specifically is also threat-modelled in design.md — don't duplicate, but
  do surface the requirement here if behaviour depends on it.

MODIFIED requirements workflow:
1. Locate existing requirement in openspec/specs/<capability>/spec.md
2. Copy ENTIRE requirement block (from ### Requirement: through all scenarios), keeping its ID
3. Paste under ## MODIFIED Requirements and edit
4. Common pitfall: Using MODIFIED with partial content loses detail at archive time
   If adding new concerns without changing behavior, use ADDED instead
5. Common pitfall in the other direction: ADDING a requirement that restates behaviour
   the live spec already covers duplicates the requirement instead of extending it.
   Read `openspec/specs/<capability>/spec.md` first — if a live requirement already owns
   the behaviour, MODIFY it and keep its ID (`openspec/config.yaml` prefers extending an
   existing spec over creating a new one).

Specs should be testable - each scenario is a potential test case.
-->
