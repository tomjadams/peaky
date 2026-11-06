const OUTBOX_TABLE_NAME = "localOutbox";

function isSchemaModule(source) {
  return (
    source === "~/local-db" ||
    source === "#shared/db/schema" ||
    source.startsWith("#shared/db/schema/")
  );
}

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

function getObjectPropertyName(property) {
  if (!property.computed && property.key.type === "Identifier") {
    return property.key.name;
  }

  if (
    property.key.type === "Literal" &&
    typeof property.key.value === "string"
  ) {
    return property.key.value;
  }

  return null;
}

function getImportedName(specifier) {
  if (specifier.imported.type === "Identifier") {
    return specifier.imported.name;
  }

  return specifier.imported.value;
}

export const enforceLocalMutationUow = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require outbox producers to use the local mutation Unit of Work",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedBypassCount: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      useLocalMutation:
        "Do not insert into localOutbox directly. Use localMutation.draft(), draftBatch(), or commit().",
      staleAllowance:
        "The Unit of Work bypass allowance is stale. Reduce allowedBypassCount to {{actual}}.",
    },
  },
  create(context) {
    const allowedBypassCount = context.options[0]?.allowedBypassCount ?? 0;
    const tableNames = new Set();
    const schemaNamespaceNames = new Set();
    const bypassNodes = [];
    let programNode;

    const isOutboxReference = (node) => {
      if (!node) {
        return false;
      }

      if (node.type === "Identifier") {
        return tableNames.has(node.name);
      }

      if (node.type !== "MemberExpression") {
        return false;
      }

      return (
        node.object.type === "Identifier" &&
        schemaNamespaceNames.has(node.object.name) &&
        getStaticPropertyName(node) === OUTBOX_TABLE_NAME
      );
    };

    return {
      Program(node) {
        programNode = node;
      },
      ImportDeclaration(node) {
        if (!isSchemaModule(node.source.value)) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            schemaNamespaceNames.add(specifier.local.name);
          } else if (
            specifier.type === "ImportSpecifier" &&
            getImportedName(specifier) === OUTBOX_TABLE_NAME
          ) {
            tableNames.add(specifier.local.name);
          }
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === "Identifier" && isOutboxReference(node.init)) {
          tableNames.add(node.id.name);
          return;
        }

        if (
          node.id.type !== "ObjectPattern" ||
          node.init?.type !== "Identifier" ||
          !schemaNamespaceNames.has(node.init.name)
        ) {
          return;
        }

        for (const property of node.id.properties) {
          if (
            property.type === "Property" &&
            !property.computed &&
            getObjectPropertyName(property) === OUTBOX_TABLE_NAME &&
            property.value.type === "Identifier"
          ) {
            tableNames.add(property.value.name);
          }
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          getStaticPropertyName(node.callee) === "insert" &&
          node.arguments[0] &&
          isOutboxReference(node.arguments[0])
        ) {
          bypassNodes.push(node);
        }
      },
      "Program:exit"() {
        if (bypassNodes.length < allowedBypassCount && programNode) {
          context.report({
            node: programNode,
            messageId: "staleAllowance",
            data: { actual: String(bypassNodes.length) },
          });
          return;
        }

        for (const node of bypassNodes.slice(allowedBypassCount)) {
          context.report({ node, messageId: "useLocalMutation" });
        }
      },
    };
  },
};
