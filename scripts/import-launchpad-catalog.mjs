import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_BASE_URL = "https://launchpad.is.adyen.com";
const DEFAULT_OUTPUT_PATH =
  "server/data/catalog-directory-mirror.snapshot.json";
const DEFAULT_EXCLUDED_GROUPS = [
  "all_employees",
  "development",
  "youtrakck-cdc-deployment",
];

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function toAbsoluteUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

function shouldSkipTlsVerification() {
  const value = process.env.LAUNCHPAD_SKIP_TLS_VERIFY?.trim();
  return value === "1" || value?.toLowerCase() === "true";
}

function normalizeTokenPayload(payload) {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    for (const key of ["access_token", "token", "accessToken"]) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  throw new Error("Launchpad token response did not include an access token");
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function requestToken(baseUrl) {
  const bearerToken = process.env.LAUNCHPAD_BEARER_TOKEN?.trim();

  if (bearerToken) {
    return bearerToken.startsWith("Bearer ")
      ? bearerToken
      : `Bearer ${bearerToken}`;
  }

  const clientId = requireEnv("LAUNCHPAD_CLIENT_ID");
  const clientSecret = requireEnv("LAUNCHPAD_CLIENT_SECRET");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const payload = await fetchJSON(
    toAbsoluteUrl(baseUrl, "/api/v1/auth/token"),
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const token = normalizeTokenPayload(payload);
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

async function fetchEntities({ baseUrl, kind, token }) {
  const url = new URL("/api/catalog/entities", baseUrl);
  url.searchParams.set("filter", `kind=${kind}`);

  const payload = await fetchJSON(url.toString(), {
    headers: token
      ? {
          authorization: token,
        }
      : undefined,
  });

  return Array.isArray(payload) ? payload : [];
}

function getGroupDisplayName(group) {
  return (
    group.spec?.groupMetadata?.humanReadableGroupName?.trim() ||
    group.metadata?.title?.trim() ||
    humanizeIdentifier(group.metadata.name)
  );
}

function getGroupDescription(group) {
  const status = group.spec?.groupMetadata?.status?.toLowerCase() || group.spec?.type || "unknown";
  return (
    group.spec?.groupMetadata?.teamPageUrl ??
    group.metadata?.description?.trim() ??
    `${group.metadata.name} (${status})`
  );
}

function humanizeIdentifier(id) {
  return id
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function addUser(usersById, id, displayName) {
  const trimmedId = id?.trim();
  if (!trimmedId) {
    return;
  }

  usersById.set(
    trimmedId,
    displayName?.trim() ||
      usersById.get(trimmedId) ||
      humanizeIdentifier(trimmedId)
  );
}

function relationCount(entity, type) {
  return (entity.relations || []).filter((relation) => relation.type === type)
    .length;
}

function buildSnapshot({
  systems,
  users,
  groups,
  generatedAt,
  excludedGroupNames,
}) {
  const excluded = new Set(
    excludedGroupNames.map((name) => name.toLowerCase())
  );
  const usersById = new Map();

  for (const user of users) {
    addUser(
      usersById,
      user.metadata?.name,
      user.spec?.profile?.displayName || user.metadata?.title
    );
  }

  for (const group of groups) {
    const metadata = group.spec?.groupMetadata;
    addUser(usersById, metadata?.primaryContact);
    addUser(usersById, metadata?.productManagerContact);
    addUser(usersById, metadata?.createdBy);
    addUser(usersById, metadata?.lastModifiedBy);
    addUser(usersById, metadata?.createdOnBehalfOf);
    addUser(usersById, metadata?.lastModifiedOnBehalfOf);
  }

  const filteredGroups = groups
    .filter((group) => !excluded.has(group.metadata?.name?.toLowerCase()))
    .map((group) => ({
      id: group.metadata.name,
      displayName: getGroupDisplayName(group),
      description: getGroupDescription(group),
      memberCount: relationCount(group, "hasMember") || undefined,
    }))
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));

  const groupNameById = new Map(
    filteredGroups.map((group) => [group.id, group.displayName])
  );

  const applications = systems
    .map((system) => ({
      id: system.metadata.name,
      displayName:
        system.metadata.title?.trim() ||
        humanizeIdentifier(system.metadata.name),
      description: system.metadata.description?.trim() || undefined,
      type: "system",
      ownerGroupId: system.spec.owner,
      ownerGroupName:
        groupNameById.get(system.spec.owner) ||
        humanizeIdentifier(system.spec.owner),
      system: system.spec.domain,
    }))
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    version: "launchpad-backstage-v1",
    generatedAt,
    users: [...usersById.entries()]
      .map(([id, displayName]) => ({ id, displayName }))
      .toSorted((a, b) => a.displayName.localeCompare(b.displayName)),
    groups: filteredGroups,
    components: applications,
  };
}

async function main() {
  const baseUrl = process.env.LAUNCHPAD_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const outputPath = resolve(
    process.cwd(),
    process.env.LAUNCHPAD_OUTPUT_PATH?.trim() || DEFAULT_OUTPUT_PATH
  );
  const excludedGroupNames = (
    process.env.LAUNCHPAD_EXCLUDED_GROUPS?.split(",") || DEFAULT_EXCLUDED_GROUPS
  )
    .map((value) => value.trim())
    .filter(Boolean);

  if (shouldSkipTlsVerification()) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const token = await requestToken(baseUrl);
  const generatedAt = new Date().toISOString();

  const [systems, users, groups] = await Promise.all([
    fetchEntities({
      baseUrl,
      kind: "system",
      token,
    }),
    fetchEntities({
      baseUrl,
      kind: "user",
      token,
    }),
    fetchEntities({
      baseUrl,
      kind: "group",
      token,
    }),
  ]);

  const snapshot = buildSnapshot({
    systems,
    users,
    groups,
    generatedAt,
    excludedGroupNames,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath,
        systems: systems.length,
        sourceUsers: users.length,
        groups: snapshot.groups.length,
        users: snapshot.users.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
