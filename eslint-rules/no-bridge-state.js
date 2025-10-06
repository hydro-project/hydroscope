/**
 * ESLint rule to prevent private state in bridge classes
 * Enforces stateless bridge architecture
 */

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent private state properties in bridge classes",
      category: "Architecture",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      prohibitedBridgeState: "Bridge class '{{className}}' contains prohibited state property '{{propertyName}}'. Bridges must be stateless - use VisualizationState for data storage.",
      prohibitedBridgeMethod: "Bridge class '{{className}}' contains prohibited cache method '{{methodName}}'. Bridges must not implement caching - use VisualizationState for data storage.",
    },
  },

  create(context) {
    // Patterns that indicate state/cache properties
    const prohibitedPropertyPatterns = [
      /.*[Cc]ache.*/,
      /.*lastState.*/,
      /.*lastResult.*/,
      /.*lastHash.*/,
      /.*stateHash.*/,
      /.*cached.*/,
      /.*memoized.*/,
      /.*stored.*/,
    ];

    // Patterns that indicate cache methods
    const prohibitedMethodPatterns = [
      /.*[Cc]ache.*/,
      /clear.*[Cc]ache.*/,
      /invalidate.*[Cc]ache.*/,
      /.*memoize.*/,
      /.*store.*/,
    ];

    // Check if a class name indicates it's a bridge
    function isBridgeClass(className) {
      return className && className.endsWith("Bridge");
    }

    // Check if a property name matches prohibited patterns
    function isProhibitedProperty(propertyName) {
      return prohibitedPropertyPatterns.some(pattern => pattern.test(propertyName));
    }

    // Check if a method name matches prohibited patterns
    function isProhibitedMethod(methodName) {
      return prohibitedMethodPatterns.some(pattern => pattern.test(methodName));
    }

    return {
      ClassDeclaration(node) {
        if (!isBridgeClass(node.id.name)) {
          return;
        }

        const className = node.id.name;

        // Check class body for prohibited properties and methods
        node.body.body.forEach(member => {
          if (member.type === "PropertyDefinition" || member.type === "ClassProperty") {
            // Check property definitions
            if (member.key && member.key.name) {
              const propertyName = member.key.name;
              if (isProhibitedProperty(propertyName)) {
                context.report({
                  node: member,
                  messageId: "prohibitedBridgeState",
                  data: {
                    className,
                    propertyName,
                  },
                });
              }
            }
          } else if (member.type === "MethodDefinition") {
            // Check method definitions
            if (member.key && member.key.name) {
              const methodName = member.key.name;
              if (isProhibitedMethod(methodName)) {
                context.report({
                  node: member,
                  messageId: "prohibitedBridgeMethod",
                  data: {
                    className,
                    methodName,
                  },
                });
              }
            }
          }
        });
      },

      // Also check for assignment expressions that might add properties to bridge instances
      AssignmentExpression(node) {
        if (
          node.left.type === "MemberExpression" &&
          node.left.object.type === "ThisExpression" &&
          node.left.property.type === "Identifier"
        ) {
          const propertyName = node.left.property.name;
          
          // Check if we're inside a bridge class
          let currentNode = node.parent;
          let className = null;
          
          while (currentNode) {
            if (currentNode.type === "ClassDeclaration" && isBridgeClass(currentNode.id.name)) {
              className = currentNode.id.name;
              break;
            }
            currentNode = currentNode.parent;
          }

          if (className && isProhibitedProperty(propertyName)) {
            context.report({
              node,
              messageId: "prohibitedBridgeState",
              data: {
                className,
                propertyName,
              },
            });
          }
        }
      },
    };
  },
};