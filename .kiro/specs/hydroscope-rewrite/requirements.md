# Hydroscope Rewrite Requirements

## Introduction

This specification defines the complete rewrite of Hydroscope from scratch, implementing a clean, robust architecture centered around VisualizationState with proper separation of concerns, synchronous core processing, and async boundary management. The rewrite will be built using test-driven development with comprehensive integration and end-to-end testing.

## Requirements

### Requirement 1: Core Architecture Foundation

**User Story:** As a developer, I want a clean separation between data management, layout processing, and rendering, so that the system is maintainable and debuggable.

#### Acceptance Criteria

1. WHEN the system is initialized THEN VisualizationState SHALL be the single source of truth for all graph data
2. WHEN data flows through the system THEN all core processing SHALL be synchronous within VisualizationState and bridges
3. WHEN async operations are needed THEN they SHALL be managed through sequential queues at async boundaries
4. WHEN state changes occur THEN they SHALL be atomic and consistent
5. WHEN debugging is needed THEN each component SHALL have clear responsibilities and boundaries

### Requirement 2: VisualizationState Core

**User Story:** As a developer, I want a robust data model that manages nodes, edges, containers, and layout state, so that all graph operations are reliable and consistent.

#### Acceptance Criteria

1. WHEN graph data is loaded THEN VisualizationState SHALL store nodes, edges, and containers with proper relationships
2. WHEN containers are collapsed/expanded THEN VisualizationState SHALL maintain consistent visibility states for all elements including edges
3. WHEN layout operations occur THEN VisualizationState SHALL track layout history and prevent invalid operations
4. WHEN searches are performed THEN VisualizationState SHALL maintain search state and results
5. WHEN state is queried THEN VisualizationState SHALL provide efficient read-only access for rendering
6. WHEN edge aggregation is managed THEN VisualizationState SHALL track original and aggregated states separately
7. WHEN edge aggregation occurs THEN VisualizationState SHALL maintain bidirectional mapping between original and aggregated edges
8. WHEN container states change THEN VisualizationState SHALL update edge aggregation states atomically

### Requirement 3: ELK Bridge Integration

**User Story:** As a developer, I want seamless integration with ELK layout engine, so that graph layouts are computed efficiently and correctly.

#### Acceptance Criteria

1. WHEN layout is requested THEN ELKBridge SHALL convert VisualizationState to ELK format synchronously
2. WHEN ELK processing completes THEN ELKBridge SHALL update VisualizationState with layout results synchronously
3. WHEN layout errors occur THEN ELKBridge SHALL handle them gracefully and report status
4. WHEN multiple layout requests occur THEN they SHALL be queued and processed sequentially
5. WHEN layout configuration changes THEN ELKBridge SHALL apply new settings correctly

### Requirement 4: ReactFlow Bridge Integration

**User Story:** As a developer, I want seamless conversion to ReactFlow format, so that the graph renders correctly in the browser.

#### Acceptance Criteria

1. WHEN rendering is requested THEN ReactFlowBridge SHALL convert VisualizationState to ReactFlow format synchronously
2. WHEN containers are collapsed THEN ReactFlowBridge SHALL render them as single nodes
3. WHEN containers are expanded THEN ReactFlowBridge SHALL render their contents
4. WHEN styling is applied THEN ReactFlowBridge SHALL convert semantic tags to visual styles
5. WHEN render data is generated THEN it SHALL be immutable and ready for React consumption

### Requirement 5: Async Boundary Management

**User Story:** As a developer, I want predictable async operation handling, so that race conditions and timing issues are eliminated.

#### Acceptance Criteria

1. WHEN ELK operations are queued THEN they SHALL execute sequentially without overlap
2. WHEN ReactFlow updates are queued THEN they SHALL execute sequentially without overlap
3. WHEN application events occur THEN they SHALL be queued and processed in order
4. WHEN async operations fail THEN the system SHALL recover gracefully
5. WHEN multiple async boundaries exist THEN they SHALL coordinate properly

### Requirement 6: Test-Driven Development

**User Story:** As a developer, I want comprehensive test coverage at every level, so that the system is reliable and regressions are prevented.

#### Acceptance Criteria

1. WHEN core components are built THEN they SHALL have unit tests with >95% coverage
2. WHEN integration points are implemented THEN they SHALL have integration tests
3. WHEN UI components are built THEN they SHALL have end-to-end tests
4. WHEN bugs are found THEN they SHALL be reproduced in tests before fixing
5. WHEN features are added THEN tests SHALL be written first
6. WHEN any task is completed THEN all tests SHALL pass before committing
7. WHEN paxos.json integration points are reached THEN incremental validation SHALL be performed
8. WHEN code is refactored THEN existing tests SHALL continue to pass

### Requirement 7: Paxos.json Test Scenario

**User Story:** As a developer, I want a consistent test scenario throughout development, so that all components work together correctly.

#### Acceptance Criteria

1. WHEN core functionality is tested THEN paxos.json SHALL be used as the primary test data
2. WHEN layout operations are tested THEN paxos.json containers SHALL expand/collapse correctly
3. WHEN rendering is tested THEN paxos.json SHALL display correctly in the browser
4. WHEN search functionality is tested THEN paxos.json nodes SHALL be searchable
5. WHEN performance is tested THEN paxos.json SHALL load and render within acceptable time limits

### Requirement 8: Container Operations

**User Story:** As a user, I want to expand and collapse containers reliably, so that I can explore the graph at different levels of detail.

#### Acceptance Criteria

1. WHEN I click expand all THEN all collapsed containers SHALL become expanded and show their contents
2. WHEN I click collapse all THEN all expanded containers SHALL become collapsed and show as single nodes
3. WHEN containers change state THEN the layout SHALL update to accommodate the new structure
4. WHEN container operations occur THEN the UI SHALL reflect the changes immediately
5. WHEN multiple container operations occur rapidly THEN they SHALL be processed correctly without conflicts
6. WHEN containers are collapsed THEN edges connecting to internal nodes SHALL be properly aggregated to container boundaries
7. WHEN containers are expanded THEN aggregated edges SHALL be restored to their original connections
8. WHEN container operations affect edges THEN edge visibility and routing SHALL be updated consistently

### Requirement 8a: Edge Aggregation During Container Operations

**User Story:** As a developer, I want edges to be handled correctly during container collapse/expand operations, so that edge connectivity is maintained and visually coherent.

#### Acceptance Criteria

1. WHEN a container is collapsed THEN edges with endpoints inside the container SHALL be aggregated to the container boundary
2. WHEN a container is expanded THEN aggregated edges SHALL be restored to their original internal endpoints
3. WHEN edges span multiple containers THEN they SHALL be handled correctly regardless of container states
4. WHEN edges connect collapsed and expanded containers THEN they SHALL route appropriately between boundaries and internal nodes
5. WHEN edge aggregation occurs THEN the aggregated edge SHALL maintain semantic properties of the original connections
6. WHEN aggregated edges are restored THEN all original connectivity and properties SHALL be preserved
7. WHEN multiple containers affect the same edge THEN the edge SHALL be managed consistently across all container state changes
8. WHEN edge visibility changes THEN the changes SHALL be atomic and consistent with container visibility states

### Requirement 9: Graph Element Click Interactions

**User Story:** As a user, I want to click on graph elements to interact with them directly, so that I can expand/collapse containers and toggle node labels intuitively.

#### Acceptance Criteria

1. WHEN I click on a container THEN the container SHALL toggle between collapsed and expanded states
2. WHEN I click on a collapsed container THEN it SHALL expand and show its internal nodes
3. WHEN I click on an expanded container THEN it SHALL collapse and show as a single node
4. WHEN I click on a graph node THEN the label SHALL toggle between short label and long label
5. WHEN a node shows long label THEN clicking again SHALL return to short label
6. WHEN container click operations occur THEN the layout SHALL update to accommodate the new structure
7. WHEN node label toggles occur THEN the layout SHALL accommodate longer text if needed
8. WHEN click interactions happen THEN the changes SHALL be reflected immediately in the UI
9. WHEN multiple rapid clicks occur THEN they SHALL be processed correctly without conflicts
10. WHEN container states change via click THEN edge aggregation SHALL be updated accordingly

### Requirement 10: Search Functionality

**User Story:** As a user, I want to search for nodes and containers, so that I can quickly find specific elements in large graphs.

#### Acceptance Criteria

1. WHEN I enter a search query THEN matching nodes and containers SHALL be highlighted
2. WHEN search results are found THEN I SHALL be able to navigate between matches
3. WHEN search expands containers THEN the expansion SHALL not be undone by smart collapse
4. WHEN search is cleared THEN highlights SHALL be removed
5. WHEN search occurs THEN performance SHALL remain responsive

### Requirement 10: Smart Collapse Prevention

**User Story:** As a developer, I want smart collapse to only run during initial layout, so that user actions are not undone by automatic operations.

#### Acceptance Criteria

1. WHEN initial layout occurs THEN smart collapse SHALL run to optimize the display
2. WHEN user expands containers THEN smart collapse SHALL NOT run during subsequent layouts
3. WHEN search expands containers THEN smart collapse SHALL NOT undo the expansion
4. WHEN layout configuration changes THEN smart collapse MAY run if appropriate
5. WHEN layout count tracking occurs THEN it SHALL accurately determine when smart collapse should run

### Requirement 11: Autonomous Development Support

**User Story:** As Kiro AI, I want clear, detailed specifications and test requirements, so that I can implement the system autonomously with minimal supervision.

#### Acceptance Criteria

1. WHEN implementing each component THEN the specification SHALL provide sufficient detail for autonomous development
2. WHEN tests are written THEN they SHALL be comprehensive enough to verify correct implementation
3. WHEN integration occurs THEN the interfaces SHALL be clearly defined and testable
4. WHEN debugging is needed THEN the architecture SHALL provide clear separation for issue isolation
5. WHEN the implementation is complete THEN it SHALL pass all tests without manual intervention

### Requirement 12: Performance and Reliability

**User Story:** As a user, I want the application to be fast and reliable, so that I can work with large graphs efficiently.

#### Acceptance Criteria

1. WHEN large graphs are loaded THEN the system SHALL remain responsive
2. WHEN layout operations occur THEN they SHALL complete within reasonable time limits
3. WHEN memory usage grows THEN it SHALL be managed efficiently
4. WHEN errors occur THEN they SHALL be handled gracefully without crashing
5. WHEN the system runs for extended periods THEN performance SHALL remain consistent

### Requirement 13: Incremental Development and Validation

**User Story:** As a developer, I want each development step to be fully validated and working, so that progress is reliable and issues are caught early.

#### Acceptance Criteria

1. WHEN any component is implemented THEN it SHALL be immediately tested with paxos.json data
2. WHEN integration points are reached THEN end-to-end validation SHALL be performed
3. WHEN tests are written THEN they SHALL follow the Red-Green-Refactor TDD cycle
4. WHEN code is committed THEN all tests SHALL pass and coverage SHALL be maintained
5. WHEN phases are completed THEN comprehensive checkpoint validation SHALL be performed
6. WHEN regressions occur THEN they SHALL be caught by existing tests before commit
7. WHEN new functionality is added THEN it SHALL integrate seamlessly with existing working code