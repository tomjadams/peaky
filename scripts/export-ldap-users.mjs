import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_LDAP_URL = "ldaps://ldap.is.adyen.com:636";
const DEFAULT_BASE_DN = "ou=People,dc=adyen,dc=com";
const DEFAULT_FILTER = "(&(objectClass=person)(uid=*))";
const DEFAULT_OUTPUT_PATH = "server/data/catalog-directory-users.snapshot.json";
const DEFAULT_PAGE_SIZE = 1000;
const ATTRIBUTES = ["uid", "displayName", "mail", "cn"];

function parseLdif(ldif) {
  return ldif
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const entry = {};

      for (const line of block.split("\n")) {
        const match = line.match(/^([^:]+)(:{1,2})\s*(.*)$/);

        if (!match) {
          continue;
        }

        const [, rawKey, separator, rawValue] = match;
        const key = rawKey.trim();
        const value =
          separator === "::"
            ? Buffer.from(rawValue.trim(), "base64").toString("utf8")
            : rawValue.trim();

        if (key === "dn") {
          entry.dn = value;
          continue;
        }

        entry[key] = value;
      }

      return entry;
    });
}

function toDirectoryUser(entry) {
  const id =
    entry.uid?.trim() || entry.dn?.split(",")[0]?.replace(/^uid=/i, "").trim();

  if (!id) {
    return null;
  }

  return {
    id,
    displayName: entry.displayName?.trim() || entry.cn?.trim() || id,
    email: entry.mail?.trim() || undefined,
  };
}

async function main() {
  const ldapUrl = process.env.LDAP_URL?.trim() || DEFAULT_LDAP_URL;
  const baseDn = process.env.LDAP_BASE_DN?.trim() || DEFAULT_BASE_DN;
  const filter = process.env.LDAP_FILTER?.trim() || DEFAULT_FILTER;
  const outputPath = resolve(
    process.cwd(),
    process.env.LDAP_USERS_OUTPUT_PATH?.trim() || DEFAULT_OUTPUT_PATH
  );
  const pageSize = Number.parseInt(
    process.env.LDAP_PAGE_SIZE?.trim() || String(DEFAULT_PAGE_SIZE),
    10
  );

  const { stdout } = await execFileAsync(
    "ldapsearch",
    [
      "-x",
      "-LLL",
      "-E",
      `pr=${pageSize}/noprompt`,
      "-H",
      ldapUrl,
      "-b",
      baseDn,
      filter,
      ...ATTRIBUTES,
    ],
    { maxBuffer: 50 * 1024 * 1024 }
  );

  const users = parseLdif(stdout)
    .map(toDirectoryUser)
    .filter(Boolean)
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(users, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath,
        ldapUrl,
        baseDn,
        count: users.length,
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
