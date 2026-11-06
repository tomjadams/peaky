# Change: Add Backend Exploration with Nitro

## Why
Currently, components are using mocked data directly within them. We need to explore how to use Nitro in Nuxt to create a proper backend that serves mock data with a review-centric approach, which will make it easier to transition to a production setup later.

## What Changes
- Add a backend API layer using Nitro server routes with a review-centric architecture
- Create server endpoints to serve mock data organized around reviews
- Implement `/review/:id` as the primary route pattern
- Modify frontend components to fetch data from the API instead of using hardcoded mocks
- Implement proper data fetching patterns in Nuxt components

## Impact
- Affected specs: New capability (backend)
- Affected code: 
  - New server routes will be added with review-centric structure
  - Components that currently use mocked data will be updated to fetch from API
  - New composables for data fetching will be created
  - URL routing will be updated to use review-based patterns
