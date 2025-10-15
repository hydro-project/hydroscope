# VisualizationState Modules

This directory contains refactored functionality extracted from `VisualizationState.ts` to improve code organization and maintainability.

## Modules

### SmartCollapseManager.ts
Handles automatic container collapse/expand logic for optimal initial layout.

**Responsibilities:**
- Smart collapse state management
- Expansion cost calculation
- Hierarchical container expansion/collapse with budget constraints
- Performance-based layout optimization

**Key Methods:**
- `shouldRunSmartCollapse()`: Determines if smart collapse should run
- `performSmartCollapse(budgetOverride?: number)`: Executes smart collapse algorithm
- `calculateExpansionCost(containerId)`: Calculates the screen area cost of expanding a container
- `enableSmartCollapseForNextLayout()`: Enables smart collapse override
- `disableSmartCollapseForUserOperations()`: Disables smart collapse for user-triggered operations
- `resetSmartCollapseState()`: Resets smart collapse state to defaults

### ValidationManager.ts
Handles invariant checking and validation of graph state.

**Responsibilities:**
- Container state validation
- Node-container relationship validation
- Edge consistency validation
- Layout dimension validation
- Invariant violation reporting

**Key Methods:**
- `validateInvariants()`: Main validation entry point
- `validateContainerStates()`: Validates container collapse/hidden states
- `validateContainerHierarchy()`: Validates parent-child relationships
- `validateNodeContainerRelationships()`: Validates node-to-container mappings
- `validateEdgeNodeConsistency()`: Validates edge endpoints exist
- `validateNoEdgesToHiddenEntities()`: Ensures no visible edges to hidden entities
- `validateCollapsedContainerDimensions()`: Validates collapsed container sizes

## Design Pattern

These modules use the **Composition Pattern**:
- Each manager class receives a reference to the `VisualizationState` instance
- The main `VisualizationState` class delegates calls to these managers
- Managers access state through the public API where possible, or through `(this.state as any)._privateField` for private fields
- This maintains encapsulation while improving code organization

## Benefits

1. **Improved Readability**: Complex logic is now in focused, single-purpose modules
2. **Better Maintainability**: Related functionality is grouped together
3. **Easier Testing**: Modules can be tested in isolation if needed
4. **Reduced File Size**: Main file reduced from 4059 to 3763 lines
5. **Zero Breaking Changes**: External API remains completely unchanged

## Future Considerations

Additional candidates for extraction:
- Edge Aggregation logic (~500 lines)
- Search & Navigation (~400 lines)
- Cache Management
- State Persistence
