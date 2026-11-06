## REMOVED Requirements

### Requirement: Member-Facing System Page

**Reason**: `/system` is an independently navigable member capability, not a local-first storage invariant.
**Migration**: Preserve the behavior under the new `system-diagnostics` capability.
**ID:** REQ-001

### Requirement: System Page Status Tiles

**Reason**: Status presentation belongs to the extracted System Diagnostics capability.
**Migration**: Preserve Database, Schema, Storage, and Sync summaries in `system-diagnostics`.
**ID:** REQ-002

### Requirement: System Page Recent Activity

**Reason**: The recent operational activity surface belongs to System Diagnostics.
**Migration**: Preserve the `peaky.system` filter, bounded result, and Events link in `system-diagnostics`.
**ID:** REQ-003

### Requirement: System Page Recovery Actions

**Reason**: User-facing recovery workflows belong to System Diagnostics.
**Migration**: Preserve tiered cache clearing and local-database recreation in `system-diagnostics`.
**ID:** REQ-004

### Requirement: Educational Copy Layer

**Reason**: Progressive explanation is behavior of the System page rather than the local-first engine.
**Migration**: Preserve the plain-language disclosure requirements in `system-diagnostics`.
**ID:** REQ-005

### Requirement: Security Exclusions On The System Page

**Reason**: These exclusions constrain the System Diagnostics product surface.
**Migration**: Preserve the prohibitions on export, raw SQL, cursor reset, and forced bootstrap in `system-diagnostics`.
**ID:** REQ-006
