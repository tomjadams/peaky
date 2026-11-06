import { enforceLocalMutationUow } from "./enforce-local-mutation-uow.mjs";
import { noDirectTeamReviewCreate } from "./no-direct-team-review-create.mjs";

export { enforceLocalMutationUow } from "./enforce-local-mutation-uow.mjs";
export { noDirectTeamReviewCreate } from "./no-direct-team-review-create.mjs";

const REMOTE_READ_NAMES = new Set(["$fetch", "fetch"]);
const REMOTE_READ_MEMBER_NAMES = new Set(["apply", "call", "raw"]);
const LOCAL_READ_NAMES = new Set([
  "getDatabase",
  "waitForLocalDbReady",
  "withDatabase",
]);
const LOCAL_OBJECT_NAMES = new Set([
  "db",
  "database",
  "local",
  "mutations",
  "repository",
]);
const LOCAL_OBJECT_SUFFIXES = ["Database", "Mutations", "Repository"];
const LOCAL_READ_PREFIXES = [
  "fetch",
  "find",
  "get",
  "list",
  "load",
  "query",
  "read",
  "resolve",
];

function getStaticPropertyName(memberExpression) {
  if (
    !memberExpression.computed &&
    memberExpression.property.type === "Identifier"
  ) {
    return memberExpression.property.name;
  }

  if (
    memberExpression.computed &&
    memberExpression.property.type === "Literal" &&
    typeof memberExpression.property.value === "string"
  ) {
    return memberExpression.property.value;
  }

  return null;
}

function getRootIdentifierName(expression) {
  let current = expression;

  while (current?.type === "MemberExpression") {
    current = current.object;
  }

  return current?.type === "Identifier" ? current.name : null;
}

function someNode(value, predicate, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return false;
  }

  seen.add(value);

  if (typeof value.type === "string" && predicate(value)) {
    return true;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "parent" || key === "loc" || key === "range") {
      continue;
    }

    if (Array.isArray(child)) {
      if (child.some((entry) => someNode(entry, predicate, seen))) {
        return true;
      }
    } else if (someNode(child, predicate, seen)) {
      return true;
    }
  }

  return false;
}

function isRemoteReadCall(node) {
  if (node.type !== "CallExpression") {
    return false;
  }

  if (node.callee.type === "Identifier") {
    return REMOTE_READ_NAMES.has(node.callee.name);
  }

  if (node.callee.type !== "MemberExpression") {
    return false;
  }

  const rootName = getRootIdentifierName(node.callee.object);
  const memberName = getStaticPropertyName(node.callee);
  return (
    rootName !== null &&
    memberName !== null &&
    REMOTE_READ_NAMES.has(rootName) &&
    REMOTE_READ_MEMBER_NAMES.has(memberName)
  );
}

function startsWithCamelCaseWord(name, word) {
  if (!name.startsWith(word)) {
    return false;
  }

  const nextCharacter = name[word.length];
  return (
    nextCharacter === undefined ||
    (nextCharacter.toUpperCase() === nextCharacter &&
      nextCharacter.toLowerCase() !== nextCharacter)
  );
}

function isLocalFunctionName(name) {
  return (
    startsWithCamelCaseWord(name, "local") ||
    LOCAL_READ_PREFIXES.some((prefix) =>
      startsWithCamelCaseWord(name, `${prefix}Local`)
    )
  );
}

function isLocalObjectName(name) {
  return (
    LOCAL_OBJECT_NAMES.has(name) ||
    startsWithCamelCaseWord(name, "local") ||
    LOCAL_OBJECT_SUFFIXES.some((suffix) => name.endsWith(suffix))
  );
}

function isLocalReadCall(node) {
  if (node.type !== "CallExpression") {
    return false;
  }

  if (node.callee.type === "Identifier") {
    return (
      LOCAL_READ_NAMES.has(node.callee.name) ||
      isLocalFunctionName(node.callee.name)
    );
  }

  if (node.callee.type !== "MemberExpression") {
    return false;
  }

  const rootName = getRootIdentifierName(node.callee.object);
  return rootName !== null && isLocalObjectName(rootName);
}

function isPromiseRejectCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    getRootIdentifierName(node.callee.object) === "Promise" &&
    getStaticPropertyName(node.callee) === "reject"
  );
}

function isSafeFallbackExpression(expression) {
  if (!expression) {
    return true;
  }

  switch (expression.type) {
    case "Literal":
      return true;
    case "Identifier":
      return expression.name === "undefined";
    case "ArrayExpression":
      return expression.elements.every(
        (element) =>
          element === null ||
          (element.type !== "SpreadElement" && isSafeNestedExpression(element))
      );
    case "ObjectExpression":
      return expression.properties.every((property) => {
        if (property.type !== "Property" || property.kind !== "init") {
          return false;
        }

        const propertyName = property.computed
          ? null
          : property.key.type === "Identifier"
            ? property.key.name
            : property.key.value;
        return (
          propertyName !== "then" &&
          (!property.computed || isSafeNestedExpression(property.key)) &&
          isSafeNestedExpression(property.value)
        );
      });
    case "TemplateLiteral":
      return expression.expressions.every(isSafeNestedExpression);
    case "UnaryExpression":
      return isSafeNestedExpression(expression.argument);
    case "BinaryExpression":
    case "LogicalExpression":
      return (
        isSafeFallbackExpression(expression.left) &&
        isSafeFallbackExpression(expression.right)
      );
    case "ConditionalExpression":
      return (
        isSafeNestedExpression(expression.test) &&
        isSafeFallbackExpression(expression.consequent) &&
        isSafeFallbackExpression(expression.alternate)
      );
    case "AssignmentExpression":
      return isSafeFallbackExpression(expression.right);
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return isSafeFallbackExpression(expression.expression);
    default:
      return false;
  }
}

function isSafeNestedExpression(expression) {
  if (expression.type === "Identifier") {
    return true;
  }

  if (
    expression.type === "ArrowFunctionExpression" ||
    expression.type === "FunctionExpression"
  ) {
    return !expression.async;
  }

  return isSafeFallbackExpression(expression);
}

function handlerReturnsSafeFallback(handler) {
  if (handler.body.type !== "BlockStatement") {
    return isSafeFallbackExpression(handler.body);
  }

  return !someNode(
    handler.body,
    (node) =>
      node.type === "ReturnStatement" &&
      !isSafeFallbackExpression(node.argument)
  );
}

function hasSafeTerminalCatch(expression) {
  if (
    expression.type !== "CallExpression" ||
    expression.callee.type !== "MemberExpression" ||
    getStaticPropertyName(expression.callee) !== "catch"
  ) {
    return false;
  }

  const handler = expression.arguments[0];
  if (
    !handler ||
    (handler.type !== "ArrowFunctionExpression" &&
      handler.type !== "FunctionExpression") ||
    handler.async ||
    !handlerReturnsSafeFallback(handler)
  ) {
    return false;
  }

  return !someNode(
    handler.body,
    (node) =>
      node.type === "ThrowStatement" ||
      node.type === "AwaitExpression" ||
      isPromiseRejectCall(node) ||
      isRemoteReadCall(node)
  );
}

function isFallibleRemoteRead(expression) {
  return (
    someNode(expression, isRemoteReadCall) && !hasSafeTerminalCatch(expression)
  );
}

function isPromiseAllCall(node) {
  return (
    node.callee.type === "MemberExpression" &&
    getRootIdentifierName(node.callee.object) === "Promise" &&
    getStaticPropertyName(node.callee) === "all"
  );
}

export const noFallibleRemoteLocalPromiseAll = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent fallible remote reads from invalidating concurrent local-first reads",
    },
    schema: [],
    messages: {
      preferLocalFirst:
        "Do not combine a fallible remote read with a local read in Promise.all. Read locally first, then fetch remotely only when needed.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isPromiseAllCall(node)) {
          return;
        }

        const values = node.arguments[0];
        if (!values || values.type !== "ArrayExpression") {
          return;
        }

        const expressions = values.elements.filter(Boolean);
        const remoteReads = new Set(expressions.filter(isFallibleRemoteRead));
        const hasSeparateLocalRead = expressions.some(
          (expression) =>
            !remoteReads.has(expression) &&
            someNode(expression, isLocalReadCall)
        );

        if (remoteReads.size > 0 && hasSeparateLocalRead) {
          context.report({ node, messageId: "preferLocalFirst" });
        }
      },
    };
  },
};

/**
 * Peaky's local-first safety rules.
 *
 * `enforce-local-mutation-uow` prevents state producers from inserting outbox
 * rows outside the transaction, event, HLC, and push guarantees of LocalMutation.
 *
 * `no-direct-team-review-create` keeps team review creation behind the domain
 * service that materializes the required local team profile first.
 *
 * `no-fallible-remote-local-promise-all` prevents a remote request and a local
 * database read from running as separate `Promise.all` branches when the remote
 * request can reject. Without this guard, a backend outage discards the
 * successful local result and turns available offline data into a page error.
 * Read local data first, then use the remote API only when local data is absent.
 */
export default {
  meta: {
    name: "peaky",
  },
  rules: {
    "enforce-local-mutation-uow": enforceLocalMutationUow,
    "no-direct-team-review-create": noDirectTeamReviewCreate,
    "no-fallible-remote-local-promise-all": noFallibleRemoteLocalPromiseAll,
  },
};
