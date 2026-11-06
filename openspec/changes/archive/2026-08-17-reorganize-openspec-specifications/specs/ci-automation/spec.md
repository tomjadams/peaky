## REMOVED Requirements

### Requirement: GitLab-Faithful Event Model

**Reason**: CI Automation is implemented and owned by the dedicated `containers/ci-automation` repository.
**Migration**: Preserve and maintain this requirement in that repository's `rtf-workflow` OpenSpec tree.
**ID:** REQ-001

### Requirement: Pure Features Returning Deferred Actions

**Reason**: The deferred-action feature contract belongs to the CI Automation repository.
**Migration**: Preserve and maintain this requirement in that repository's live capability specs.
**ID:** REQ-002

### Requirement: Explicit Action Types

**Reason**: Typed CI Automation actions are not a Peaky capability.
**Migration**: Preserve and maintain this requirement in the CI Automation repository.
**ID:** REQ-003

### Requirement: Event Subscription via RUNS_ON

**Reason**: Feature event subscription is owned by the CI Automation implementation.
**Migration**: Preserve and maintain this requirement in the CI Automation repository.
**ID:** REQ-004

### Requirement: Slim Feature Boundary

**Reason**: The feature/plugin boundary is an architectural contract of CI Automation.
**Migration**: Preserve and maintain this requirement in the CI Automation repository.
**ID:** REQ-005

### Requirement: Issue-to-Epic Traceability Gate

**Reason**: Peaky consumes this governance feature but does not own its implementation contract.
**Migration**: Maintain the feature requirement in CI Automation and retain only Peaky's consumer configuration locally.
**ID:** REQ-006

### Requirement: Title Enrichment with Linked Issue References

**Reason**: Merge-request title enrichment is implemented by CI Automation.
**Migration**: Maintain the feature requirement in CI Automation and retain only Peaky's enabled configuration locally.
**ID:** REQ-007

### Requirement: Bounded Governance Performance

**Reason**: Governance fast-lane performance is a CI Automation service contract.
**Migration**: Preserve and maintain this requirement in the CI Automation repository.
**ID:** REQ-008

### Requirement: Dry-Run Preview

**Reason**: Simulation behavior belongs to CI Automation.
**Migration**: Preserve and maintain this requirement in the CI Automation repository.
**ID:** REQ-009

### Requirement: Transport-Independent Feature Contract

**Reason**: Transport independence is an architectural contract of CI Automation.
**Migration**: Preserve and maintain this requirement in the CI Automation repository.
**ID:** REQ-010
