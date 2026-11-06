# Backend Exploration Design

## Context
The ORR application currently uses mocked data directly within components. To prepare for a more production-ready setup, we need to explore how to use Nitro in Nuxt to create a proper backend API layer. This will help us learn the Nuxt API patterns and make it easier to transition to a real backend later.

## Goals / Non-Goals

### Goals
- Create a clean separation between frontend and backend
- Establish patterns for API data fetching in Nuxt
- Learn how Nitro server works in Nuxt
- Create reusable composables for data fetching

### Non-Goals
- Production-ready database integration
- Authentication/authorization system
- Complex API validation
- Full CRUD operations (focus on read operations for now)

## Decisions

### Decision: Use Nitro Server Routes
Nitro is the server engine that powers Nuxt applications. It provides a way to create API endpoints directly within the Nuxt application. We'll use Nitro server routes to create our backend API.

**Alternatives considered:**
- External API server: Would require more setup and wouldn't help us learn Nuxt's built-in capabilities
- Mock Service Worker (MSW): Good for mocking APIs but doesn't help us learn Nitro

### Decision: Server Directory Structure
We'll follow the Nuxt convention of using the `server/` directory for our API routes:
- `server/api/` - API endpoints
- `server/utils/` - Utility functions
- `server/data/` - Mock data files

**Alternatives considered:**
- Custom directory structure: Would deviate from Nuxt conventions and make it harder to follow standard patterns

### Decision: Data Fetching Pattern
We'll use Nuxt's `useFetch` and `useAsyncData` composables for data fetching, with custom wrappers for specific API endpoints.

**Alternatives considered:**
- Axios/Fetch directly: Wouldn't leverage Nuxt's built-in caching and SSR capabilities
- Custom fetch implementation: Would reinvent functionality that Nuxt already provides

## Risks / Trade-offs

- **Risk**: Learning curve for Nitro and Nuxt server features
  → Mitigation: Start with simple endpoints and gradually add complexity

- **Risk**: Potential for inconsistent API patterns
  → Mitigation: Establish clear conventions and document them

- **Risk**: Mock data might not represent real-world complexity
  → Mitigation: Design mock data to be as realistic as possible

## Migration Plan

This is an exploratory change, so a full migration plan isn't necessary. However, we'll:

1. Start by creating the API endpoints
2. Then update one component at a time to use the API
3. Document the patterns we establish for future reference

## Open Questions

- How should we handle error states in the UI when API calls fail?
  - Yes. You can also use NuxtUI to show a toast notification but be mindful not to turn into a spammy experience (or when people keeps hitting refresh).
- What's the best way to structure mock data to make it easy to replace with real data later?
  - Keep it simple for now, we're only exploring Nitro.
- Should we implement any caching strategies beyond what Nuxt provides?
  - Keep it simple for now, we're only exploring Nitro.
