/**
 * ValidationManager - Handles invariant checking and validation
 * Extracted from VisualizationState for better organization
 */
import type { InvariantViolation } from "../../types/core.js";
import type { VisualizationState } from "../VisualizationState.js";
import { SIZES } from "../../shared/config.js";

export class ValidationManager {
  private state: VisualizationState;
  private _validationEnabled = true;
  private _validationInProgress = false;

  constructor(state: VisualizationState) {
    this.state = state;
  }

  get validationEnabled(): boolean {
    return this._validationEnabled;
  }

  set validationEnabled(value: boolean) {
    this._validationEnabled = value;
  }

  get validationInProgress(): boolean {
    return this._validationInProgress;
  }

  validateInvariants(): void {
    if (!this._validationEnabled || this._validationInProgress) {
      return;
    }
    this._validationInProgress = true;
    try {
      const violations: InvariantViolation[] = [];
      // Container State Invariants
      violations.push(...this.validateContainerStates());
      violations.push(...this.validateContainerHierarchy());
      // Node State Invariants
      violations.push(...this.validateNodeContainerRelationships());
      // Edge Invariants
      violations.push(...this.validateEdgeNodeConsistency());
      violations.push(...this.validateNoEdgesToHiddenEntities());
      // Layout Invariants
      violations.push(...this.validateCollapsedContainerDimensions());
      this.reportViolations(violations);
    } finally {
      this._validationInProgress = false;
    }
  }

  private validateContainerStates(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    for (const [containerId, container] of (this.state as any)._containers) {
      // Illegal Expanded/Hidden state
      if (!container.collapsed && container.hidden) {
        violations.push({
          type: "ILLEGAL_CONTAINER_STATE",
          message: `Container ${containerId} is in illegal Expanded/Hidden state`,
          entityId: containerId,
          severity: "error",
        });
      }
    }
    return violations;
  }

  private validateContainerHierarchy(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    for (const [containerId, container] of (this.state as any)._containers) {
      if (container.collapsed) {
        this.validateDescendantsCollapsed(containerId, violations);
      }
      if (!container.hidden) {
        this.validateAncestorsVisible(containerId, violations);
      }
    }
    return violations;
  }

  private validateDescendantsCollapsed(
    containerId: string,
    violations: InvariantViolation[],
  ): void {
    const children = this.state.getContainerChildren(containerId);
    for (const childId of children) {
      const childContainer = this.state.getContainer(childId);
      if (childContainer) {
        if (!childContainer.collapsed) {
          violations.push({
            type: "CONTAINER_INVARIANT",
            message: `Child container ${childId} should be collapsed when parent ${containerId} is collapsed`,
            entityId: childId,
            severity: "error",
          });
        }
        // Recursively validate
        this.validateDescendantsCollapsed(childId, violations);
      }
    }
  }

  private validateAncestorsVisible(
    containerId: string,
    violations: InvariantViolation[],
  ): void {
    let currentId = containerId;
    while (currentId) {
      const parent = this.state.getContainerParent(currentId);
      if (parent) {
        const parentContainer = this.state.getContainer(parent);
        if (parentContainer && parentContainer.hidden) {
          violations.push({
            type: "CONTAINER_INVARIANT",
            message: `Container ${containerId} is visible but ancestor ${parent} is hidden`,
            entityId: containerId,
            severity: "error",
          });
        }
        currentId = parent;
      } else {
        break;
      }
    }
  }

  validateNodeContainerRelationships(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const allContainers = (this.state as any)._containers;
    const allNodes = (this.state as any)._nodes;
    const nodeContainerMap = (this.state as any)._nodeContainerMap;

    for (const [nodeId] of allNodes) {
      const containerId = nodeContainerMap.get(nodeId);
      if (containerId) {
        const container = allContainers.get(containerId);
        if (!container) {
          violations.push({
            type: "NODE_CONTAINER_MAPPING",
            message: `Node ${nodeId} references non-existent container ${containerId}`,
            entityId: nodeId,
            severity: "error",
          });
        } else if (!container.children.has(nodeId)) {
          violations.push({
            type: "NODE_CONTAINER_MAPPING",
            message: `Node ${nodeId} claims to be in container ${containerId}, but container doesn't list it as a child`,
            entityId: nodeId,
            severity: "error",
          });
        }
      }
    }
    return violations;
  }

  validateEdgeNodeConsistency(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const allEdges = (this.state as any)._edges;
    const allNodes = (this.state as any)._nodes;
    const allContainers = (this.state as any)._containers;

    for (const [edgeId, edge] of allEdges) {
      const sourceExists =
        allNodes.has(edge.source) || allContainers.has(edge.source);
      const targetExists =
        allNodes.has(edge.target) || allContainers.has(edge.target);

      if (!sourceExists) {
        violations.push({
          type: "EDGE_NODE_CONSISTENCY",
          message: `Edge ${edgeId} references non-existent source: ${edge.source}`,
          entityId: edgeId,
          severity: "error",
        });
      }
      if (!targetExists) {
        violations.push({
          type: "EDGE_NODE_CONSISTENCY",
          message: `Edge ${edgeId} references non-existent target: ${edge.target}`,
          entityId: edgeId,
          severity: "error",
        });
      }
    }
    return violations;
  }

  validateNoEdgesToHiddenEntities(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const allEdges = (this.state as any)._edges;
    const allNodes = (this.state as any)._nodes;
    const allContainers = (this.state as any)._containers;

    for (const [edgeId, edge] of allEdges) {
      if (edge.hidden) continue;

      const sourceNode = allNodes.get(edge.source);
      const targetNode = allNodes.get(edge.target);
      const sourceContainer = allContainers.get(edge.source);
      const targetContainer = allContainers.get(edge.target);

      if (sourceNode && sourceNode.hidden) {
        violations.push({
          type: "EDGE_HIDDEN_ENTITY",
          message: `Visible edge ${edgeId} references hidden source node: ${edge.source}`,
          entityId: edgeId,
          severity: "error",
        });
      }
      if (targetNode && targetNode.hidden) {
        violations.push({
          type: "EDGE_HIDDEN_ENTITY",
          message: `Visible edge ${edgeId} references hidden target node: ${edge.target}`,
          entityId: edgeId,
          severity: "error",
        });
      }
      if (sourceContainer && sourceContainer.hidden) {
        violations.push({
          type: "EDGE_HIDDEN_ENTITY",
          message: `Visible edge ${edgeId} references hidden source container: ${edge.source}`,
          entityId: edgeId,
          severity: "error",
        });
      }
      if (targetContainer && targetContainer.hidden) {
        violations.push({
          type: "EDGE_HIDDEN_ENTITY",
          message: `Visible edge ${edgeId} references hidden target container: ${edge.target}`,
          entityId: edgeId,
          severity: "error",
        });
      }
    }
    return violations;
  }

  validateCollapsedContainerDimensions(): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const allContainers = (this.state as any)._containers;

    for (const [containerId, container] of allContainers) {
      if (container.collapsed) {
        const width = container.width || SIZES.COLLAPSED_CONTAINER_WIDTH;
        const height = container.height || SIZES.COLLAPSED_CONTAINER_HEIGHT;

        if (width !== SIZES.COLLAPSED_CONTAINER_WIDTH) {
          violations.push({
            type: "CONTAINER_DIMENSIONS",
            message: `Collapsed container ${containerId} has incorrect width ${width}, expected ${SIZES.COLLAPSED_CONTAINER_WIDTH}`,
            entityId: containerId,
            severity: "warning",
          });
        }
        if (height !== SIZES.COLLAPSED_CONTAINER_HEIGHT) {
          violations.push({
            type: "CONTAINER_DIMENSIONS",
            message: `Collapsed container ${containerId} has incorrect height ${height}, expected ${SIZES.COLLAPSED_CONTAINER_HEIGHT}`,
            entityId: containerId,
            severity: "warning",
          });
        }
      }
    }
    return violations;
  }

  private reportViolations(violations: InvariantViolation[]): void {
    if (violations.length === 0) return;

    const errors = violations.filter((v) => v.severity === "error");
    const warnings = violations.filter((v) => v.severity === "warning");

    if (warnings.length > 0) {
      console.warn("[VisualizationState] Invariant warnings:", warnings);
    }

    if (errors.length > 0) {
      console.error(
        "[VisualizationState] CRITICAL: Invariant violations:",
        errors,
      );
      throw new Error(
        `VisualizationState invariant violations: ${errors.map((e) => e.message).join("; ")}`,
      );
    }
  }
}
