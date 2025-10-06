/**
 * ESLint rule to enforce bridge interface implementation
 * Ensures bridges implement required interfaces for stateless behavior
 */

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce bridge classes implement required stateless interfaces",
      category: "Architecture",
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      missingBridgeInterface: "Bridge class '{{className}}' must implement interface '{{interfaceName}}' to enforce stateless behavior.",
      missingBridgeImport: "Bridge file must import bridge interfaces from '../types/bridges.js' to enforce architectural constraints.",
    },
  },

  create(context) {
    const filename = context.getFilename();
    const isBridgeFile = filename.includes("Bridge.ts") && filename.includes("/bridges/");
    
    if (!isBridgeFile) {
      return {}; // Only check bridge files
    }

    let hasInterfaceImport = false;
    let bridgeClasses = [];

    // Map bridge class names to required interfaces
    const requiredInterfaces = {
      "ReactFlowBridge": "IReactFlowBridge",
      "ELKBridge": "IELKBridge",
      "BridgeFactory": "IBridgeFactory",
    };

    return {
      ImportDeclaration(node) {
        // Check for bridge interface imports
        if (node.source.value.includes("types/bridges")) {
          hasInterfaceImport = true;
        }
      },

      ClassDeclaration(node) {
        if (!node.id || !node.id.name) return;

        const className = node.id.name;
        
        // Check if this is a bridge class
        if (className.endsWith("Bridge") || className === "BridgeFactory") {
          bridgeClasses.push({
            node,
            className,
            hasInterface: false,
          });

          // Check if class implements required interface
          const requiredInterface = requiredInterfaces[className];
          if (requiredInterface && node.implements) {
            const implementsRequired = node.implements.some(impl => {
              return impl.expression && impl.expression.name === requiredInterface;
            });

            if (implementsRequired) {
              bridgeClasses[bridgeClasses.length - 1].hasInterface = true;
            }
          }
        }
      },

      "Program:exit"() {
        // Check if bridge file imports required interfaces
        if (bridgeClasses.length > 0 && !hasInterfaceImport) {
          context.report({
            node: bridgeClasses[0].node,
            messageId: "missingBridgeImport",
          });
        }

        // Check each bridge class for interface implementation
        bridgeClasses.forEach(({ node, className, hasInterface }) => {
          const requiredInterface = requiredInterfaces[className];
          
          if (requiredInterface && !hasInterface) {
            context.report({
              node,
              messageId: "missingBridgeInterface",
              data: {
                className,
                interfaceName: requiredInterface,
              },
            });
          }
        });
      },
    };
  },
};