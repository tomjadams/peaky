## REMOVED Requirements

The current live capability is a Rules Manager specification under a future-facing Maturity Score name. Removing these requirements does not define replacement scoring behavior.

### Requirement: Rule Set Data Model

**Reason**: The Rule Set domain model belongs to the removed Rules Manager and has no runtime scoring implementation.
**Migration**: Remove Rule Set models and persistence. Future Maturity Score work must define a new model through its own OpenSpec change.
**ID:** REQ-001

### Requirement: Rules Mode Navigation

**Reason**: Template Studio no longer exposes a Rules mode or route.
**Migration**: Remove the Rules route, mode toggle, and Rules navigation commands. Legacy Rules URLs use the normal not-found behavior.
**ID:** REQ-002

### Requirement: Rules Canvas

**Reason**: The Vue Flow Rules authoring canvas is removed with Rules Manager.
**Migration**: Remove the Rules canvas components and Vue Flow dependencies.
**ID:** REQ-003

### Requirement: Question Sidebar

**Reason**: The Rules-only question sidebar has no surviving product behavior.
**Migration**: Remove the Rules sidebar and its drag-and-drop integration.
**ID:** REQ-004

### Requirement: Rule Set Node

**Reason**: Rule Set nodes and their action/condition editor are removed with Rules Manager.
**Migration**: Remove Rule Set node components, composables, and tests.
**ID:** REQ-005

### Requirement: Multi-Rule Question Detection

**Reason**: Multi-Rule warnings are specific to the removed Rule Set model.
**Migration**: Remove multi-Rule projections, badges, toolbar warnings, and tests.
**ID:** REQ-006

### Requirement: Rule Validation

**Reason**: Rules no longer participate in Template validation or publication.
**Migration**: Remove Rule validation while retaining question, checklist, and Markdown safety validation.
**ID:** REQ-007

### Requirement: Rule Persistence

**Reason**: Rule persistence stores an unused authoring feature and would burden the next Template model.
**Migration**: Forward SQLite and PostgreSQL migrations intentionally delete Rules tables and data while preserving all non-Rule Template data.
**ID:** REQ-008
