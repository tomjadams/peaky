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

function isDirectTeamReviewCreate(node) {
  if (
    node.callee.type !== "MemberExpression" ||
    node.callee.object.type !== "Identifier" ||
    node.callee.object.name !== "reviewMutations" ||
    getStaticPropertyName(node.callee) !== "create"
  ) {
    return false;
  }

  const input = node.arguments[0];
  if (!input || input.type !== "ObjectExpression") {
    return false;
  }

  return input.properties.some((property) => {
    if (property.type !== "Property" || property.computed) {
      return false;
    }

    const name =
      property.key.type === "Identifier"
        ? property.key.name
        : property.key.value;
    return (
      name === "subjectType" &&
      property.value.type === "Literal" &&
      property.value.value === "team"
    );
  });
}

export const noDirectTeamReviewCreate = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require team reviews to use the profile-preserving domain service",
    },
    schema: [],
    messages: {
      useTeamReviewService:
        "Create team reviews through teamReviewService so the local team profile is guaranteed to exist first.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isDirectTeamReviewCreate(node)) {
          context.report({ node, messageId: "useTeamReviewService" });
        }
      },
    };
  },
};
