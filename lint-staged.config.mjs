// Moved from package.json so the JS task can skip lint-ignored paths.
// oxlint/eslint exit non-zero when every file passed to them is ignored
// ("No files found to lint"), which broke commits that stage only assets
// under an ignorePatterns entry (.factory/, public/sqlite3*, …).
import { relative, sep } from "node:path";

const LINT_IGNORED = [
  ".factory/", // includes .factory/skills/explainer/ — browser-runtime JS assembled into self-contained HTML + vendored Motion
  "public/sqlite3",
  "site/docs/javascripts/",
];

const lintable = (files) =>
  files.filter((f) => {
    const rel = relative(process.cwd(), f).split(sep).join("/");
    return !LINT_IGNORED.some((p) => rel.startsWith(p));
  });

// Quote each path for the shell — staged paths can contain spaces, and
// these commands are built as strings, not passed as an argv array.
const quote = (f) => `"${f.replace(/"/g, '\\"')}"`;

export default {
  "*.{js,jsx,ts,tsx,vue}": (files) => {
    const targets = lintable(files);
    if (targets.length === 0) return [];
    // A staged file literally named e.g. "--rulesdir=./evil.js" would
    // otherwise be indistinguishable from a real flag once interpolated
    // into the command string — `--` tells each of these tools (verified:
    // oxlint, eslint, oxfmt, vitest all accept it) that everything after
    // is a path, never an option.
    const list = "-- " + targets.map(quote).join(" ");
    return [
      `oxlint --fix ${list}`,
      `eslint --fix ${list}`,
      `oxfmt ${list}`,
      `vitest related --run ${list}`,
    ];
  },
  "*.md": (files) => {
    // Active OpenSpec deltas must pass structural and stable-ID validation before commit.
    const activeSpecs = files.filter((file) =>
      /^openspec\/changes\/(?!archive\/)[^/]+\/specs\/.+\/spec\.md$/.test(
        relative(process.cwd(), file).split(sep).join("/")
      )
    );
    const commands = activeSpecs.length ? ["make openspec-validate"] : [];
    commands.push(`rumdl fmt -- ${files.map(quote).join(" ")}`);
    return commands;
  },
};
