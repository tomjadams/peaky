# Catalog directory mirror refresh

The checked-in mirror lives at `server/data/catalog-directory-mirror.snapshot.json`.

## Refresh from Launchpad

```bash
LAUNCHPAD_BEARER_TOKEN="Bearer <token>" LAUNCHPAD_SKIP_TLS_VERIFY=1 pnpm run catalog:import
```

This reads Launchpad Backstage entities from `/api/catalog/entities` and rewrites the checked-in mirror snapshot.

## Optional LDAP fallback

```bash
pnpm run ldap:users:export
```

Use this only when Launchpad user entities are unavailable and you need a fresh user dump from LDAP.

## After refresh

Run:

```bash
make typecheck
make lint
```

The client bootstrap compares both `snapshot.version` and `snapshot.generatedAt`, so after restarting the app or reloading a fresh browser session, the local catalog mirror will refresh to the newly imported snapshot.
