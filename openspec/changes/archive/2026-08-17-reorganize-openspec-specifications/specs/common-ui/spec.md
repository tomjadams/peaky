## REMOVED Requirements

### Requirement: Nitro Server API

**Reason**: Domain APIs and local-first synchronization are specified by their owning capabilities; the legacy shared mock-data API layer no longer exists.
**Migration**: Keep endpoint behavior in domain specs and server implementation guidance in the contributor documentation.
**ID:** REQ-001

### Requirement: Data Fetching Patterns

**Reason**: A single remote-fetching pattern conflicts with local-first domain reads and does not describe one user-facing capability.
**Migration**: Specify local or remote data access in each owning domain and keep composable conventions in developer documentation.
**ID:** REQ-002

### Requirement: Spec Organization by Domain

**Reason**: Specification organization is repository process policy, not Common UI product behavior.
**Migration**: Maintain the DDD placement rule in `openspec/config.yaml` and contributor guidance.
**ID:** REQ-003
