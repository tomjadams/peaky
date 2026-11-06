## REMOVED Requirements

### Requirement: Product Improvement Plan

**Reason**: Improvement Plans are a shared bounded context across review subjects rather than product entity behavior.
**Migration**: Preserve product contributors, route, tone, and drilldown requirements under `improvement-plans`.
**ID:** REQ-001

### Requirement: Product Cross-Review Rollups

**Reason**: Exact cross-review grouping is owned by the Improvement Plans projection.
**Migration**: Preserve product-level source attribution and exact-identity grouping under `improvement-plans`.
**ID:** REQ-002
