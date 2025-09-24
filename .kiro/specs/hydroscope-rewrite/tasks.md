# Hydroscope Rewrite Implementation Plan

## Test-Driven Development (TDD) Workflow

**CRITICAL**: This project MUST follow strict TDD practices for incremental, reliable development:

### TDD Cycle for Each Task:

1. **RED**: Write failing tests first (before any implementation code)
2. **GREEN**: Write minimal code to make tests pass
3. **REFACTOR**: Improve code while keeping tests green
4. **COMMIT**: Commit working code with passing tests

### Incremental Development Rules:

1. **Tests First**: Every function/method must have tests before implementation
2. **Small Steps**: Each commit should add one small, working piece of functionality
3. **Always Working**: After each commit, all tests must pass
4. **Integration Points**: Test integration between components immediately when connecting them
5. **Paxos.json Validation**: Every major component must be tested with paxos.json data

### Git Workflow Instructions:

**IMPORTANT**: After completing each task, you MUST commit your work to maintain progress tracking:

1. **Write tests first**: Create failing tests for the functionality
2. **Implement minimal code**: Make tests pass with simplest possible implementation
3. **Run all tests**: Ensure no regressions (`npm test`)
4. **Stage changes**: Run `git add .` to stage all changes
5. **Commit with test status**: Run `git commit -m "feat: [task-number] [brief description] - tests passing"`
6. **Example**: `git commit -m "feat: 2.1 implement VisualizationState CRUD operations with validation - tests passing"`

### Test Requirements for Each Task:

- **Unit Tests**: Test individual functions/methods in isolation
- **Integration Tests**: Test component interactions
- **Paxos.json Tests**: Validate with real data at every integration point
- **Error Cases**: Test failure scenarios and edge cases
- **Performance Tests**: Ensure acceptable performance with paxos.json

This ensures:

- Code works incrementally at every step
- No regressions are introduced
- Each piece is thoroughly validated
- Progress is never lost
- Clear development history with working checkpoints

## Phase 1: Core Foundation

- [x] 1. Set up project structure and core interfaces
  - **TDD Step 1 (RED)**: Write tests for project structure validation and interface compliance
  - **TDD Step 2 (GREEN)**: Create clean directory structure for new implementation
  - **TDD Step 3 (GREEN)**: Define TypeScript interfaces for all core data types
  - **TDD Step 4 (GREEN)**: Set up testing framework with comprehensive coverage reporting
  - **TDD Step 5 (GREEN)**: Create paxos.json test data utilities
  - **TDD Step 6 (REFACTOR)**: Optimize project structure and interfaces
  - **VERIFY**: Run `npm test` - all tests must pass
  - **COMMIT**: `git add . && git commit -m "feat: 1 set up project structure and core interfaces - tests passing"`
  - _Requirements: 1.1, 6.1, 7.1_

- [x] 2. Implement VisualizationState core data management
  - [x] 2.1 Create VisualizationState class with basic CRUD operations
    - **TDD Step 1 (RED)**: Write failing tests for node CRUD operations
    - **TDD Step 2 (GREEN)**: Implement node add/remove/update operations with validation
    - **TDD Step 3 (RED)**: Write failing tests for edge CRUD operations
    - **TDD Step 4 (GREEN)**: Implement edge add/remove/update operations with validation
    - **TDD Step 5 (RED)**: Write failing tests for container CRUD operations
    - **TDD Step 6 (GREEN)**: Implement container add/remove/update operations with validation
    - **TDD Step 7 (RED)**: Write comprehensive unit tests for error cases and edge conditions
    - **TDD Step 8 (GREEN)**: Handle all error cases and edge conditions
    - **TDD Step 9 (REFACTOR)**: Optimize CRUD operations while keeping tests green
    - **VERIFY**: Run `npm test` - all tests must pass, >95% coverage
    - **COMMIT**: `git add . && git commit -m "feat: 2.1 create VisualizationState class with basic CRUD operations - tests passing"`
    - _Requirements: 2.1, 6.1_

  - [x] 2.2 Implement container hierarchy and relationship management
    - Code parent-child relationships between containers and nodes
    - Implement efficient lookup maps for O(1) relationship queries
    - Add validation for circular dependencies and orphaned nodes
    - Write unit tests for all relationship operations
    - **COMMIT**: `git add . && git commit -m "feat: 2.2 implement container hierarchy and relationship management"`
    - _Requirements: 2.1, 2.2_

  - [x] 2.3 Implement container visibility and collapse/expand logic with edge aggregation
    - Code container collapse/expand operations with state consistency
    - Implement visibility propagation (collapsed containers hide children)
    - Implement edge aggregation when containers are collapsed (edges to internal nodes become edges to container)
    - Implement edge restoration when containers are expanded (aggregated edges restored to original connections)
    - Add bulk operations (expandAll/collapseAll) with atomic transactions and edge aggregation handling
    - Handle complex edge aggregation scenarios (multi-container, nested containers)
    - Write comprehensive unit tests for all visibility operations and edge aggregation management
    - **COMMIT**: `git add . && git commit -m "feat: 2.3 implement container visibility and collapse/expand logic with edge aggregation"`
    - _Requirements: 2.2, 8.1, 8.2, 8a.1, 8a.2, 8a.7_

- [x] 3. Implement layout state management
  - [x] 3.1 Create layout state tracking in VisualizationState
    - Implement layout phase tracking (initial, laying_out, ready, etc.)
    - Add layout count tracking for smart collapse logic
    - Implement layout error handling and recovery
    - Write unit tests for layout state management
    - **COMMIT**: `git add . && git commit -m "feat: 3.1 create layout state tracking in VisualizationState"`
    - _Requirements: 2.3, 10.5_

  - [x] 3.2 Implement smart collapse prevention logic
    - Code isFirstLayout() method based on layout count
    - Implement layout count increment on successful layouts
    - Add smart collapse flag management for user operations
    - Write unit tests for smart collapse prevention scenarios
    - **COMMIT**: `git add . && git commit -m "feat: 3.2 implement smart collapse prevention logic"`
    - _Requirements: 10.1, 10.2, 10.3_

- [-] 4. Implement edge aggregation management system
  - [x] 4.1 Create AggregatedEdge data structures and tracking
    - Implement AggregatedEdge interface for container boundary edges
    - Code edge aggregation tracking with bidirectional mapping to original edges
    - Implement efficient lookup structures for aggregated edge management
    - Write comprehensive unit tests for aggregated edge data structures
    - **COMMIT**: `git add . && git commit -m "feat: 4.1 create AggregatedEdge data structures and tracking"`
    - _Requirements: 2.1, 8a.5, 8a.6_

  - [x] 4.2 Implement edge aggregation and restoration algorithms
    - Code edge aggregation algorithm for container collapse (internal edges become container boundary edges)
    - Implement edge restoration algorithm for container expand (aggregated edges restored to original internal connections)
    - Handle multi-container edge scenarios and nested container edge aggregation
    - Add performance optimizations for large edge sets during aggregation
    - Write unit tests for all aggregation and restoration scenarios
    - **COMMIT**: `git add . && git commit -m "feat: 4.2 implement edge aggregation and restoration algorithms"`
    - _Requirements: 8a.1, 8a.2, 8a.3, 8a.4, 8a.7_

- [x] 5. Implement graph element interaction system
  - [x] 5.1 Create interaction state management in VisualizationState
    - Implement node label toggle state tracking (showingLongLabel)
    - Code container click handling for expand/collapse operations
    - Add interaction state persistence and restoration
    - Write unit tests for all interaction state management
    - **COMMIT**: `git add . && git commit -m "feat: 5.1 create interaction state management in VisualizationState"`
    - _Requirements: 9.1, 9.4, 9.5_

  - [x] 5.2 Implement InteractionHandler for click event processing
    - Code click event processing for nodes and containers
    - Implement click debouncing and rapid click handling
    - Add coordination between interaction events and layout updates
    - Handle interaction event queuing through AsyncCoordinator
    - Write unit tests for click event processing with paxos.json data
    - **COMMIT**: `git add . && git commit -m "feat: 5.2 implement InteractionHandler for click event processing"`
    - _Requirements: 9.1, 9.2, 9.3, 9.8, 9.9_

- [x] 6. Implement search functionality in VisualizationState
  - [x] 4.1 Create search state management
    - Implement search query storage and history
    - Code search result data structures with match highlighting
    - Add search state clearing and reset functionality
    - Write unit tests for search state management
    - **COMMIT**: `git add . && git commit -m "feat: 4.1 create search state management"`
    - _Requirements: 2.3, 9.4_

  - [x] 4.2 Implement search algorithms and result generation
    - Code fuzzy search algorithm for nodes and containers
    - Implement search result ranking and sorting
    - Add search match highlighting with character indices
    - Write unit tests for search algorithms with paxos.json data
    - **COMMIT**: `git add . && git commit -m "feat: 4.2 implement search algorithms and result generation"`
    - _Requirements: 9.1, 9.2, 7.2_

- [ ] 5. Create comprehensive VisualizationState integration tests
  - [ ] 5.1 Test paxos.json data loading and parsing
    - Load paxos.json and verify all nodes/edges/containers are created
    - Validate container hierarchy matches expected structure
    - Test search functionality with paxos.json node names
    - Verify performance with paxos.json data size
    - **COMMIT**: `git add . && git commit -m "feat: 5.1 test paxos.json data loading and parsing"`
    - _Requirements: 7.1, 7.4, 12.1_

  - [ ] 5.2 Test container operations with paxos.json
    - Test expand/collapse operations on paxos.json containers
    - Verify container state consistency after bulk operations
    - Test search expansion scenarios with paxos.json
    - Validate layout state tracking during container operations
    - **COMMIT**: `git add . && git commit -m "feat: 5.2 test container operations with paxos.json"`
    - _Requirements: 7.2, 8.3, 9.3_

## Phase 2: Bridge Implementation

- [x] 6. Implement ELKBridge for layout processing
  - [x] 6.1 Create ELK format conversion from VisualizationState
    - Code synchronous conversion from VisualizationState to ELK graph format
    - Implement container handling (collapsed containers as single nodes)
    - Add layout configuration application (algorithm, direction, spacing)
    - Write unit tests for ELK conversion with paxos.json data
    - **COMMIT**: `git add . && git commit -m "feat: 6.1 create ELK format conversion from VisualizationState"`
    - _Requirements: 3.1, 3.3, 7.2_

  - [x] 6.2 Implement ELK result application back to VisualizationState
    - Code synchronous application of ELK layout results to node positions
    - Implement container dimension and position updates
    - Add layout validation and error handling
    - Write unit tests for ELK result application
    - **COMMIT**: `git add . && git commit -m "feat: 6.2 implement ELK result application back to VisualizationState"`
    - _Requirements: 3.2, 3.3_

  - [x] 6.3 Add ELK configuration management and optimization
    - Implement layout configuration updates and validation
    - Code ELK-specific optimizations for large graphs
    - Add layout hints and performance tuning
    - Write unit tests for configuration management
    - **COMMIT**: `git add . && git commit -m "feat: 6.3 add ELK configuration management and optimization"`
    - _Requirements: 3.5, 12.1_

- [x] 7. Implement ReactFlowBridge for rendering
  - [x] 7.1 Create ReactFlow format conversion from VisualizationState with edge aggregation and interaction support
    - Code synchronous conversion from VisualizationState to ReactFlow nodes/edges
    - Implement collapsed container rendering as single nodes with click handlers
    - Implement expanded container rendering with child nodes and click handlers
    - Implement node rendering with label/longLabel toggle and click handlers
    - Implement edge rendering for both original edges and aggregated edges
    - Handle edge routing between container boundaries and internal nodes
    - Attach click event handlers for container toggle and node label toggle
    - Write unit tests for ReactFlow conversion with paxos.json data including edge aggregation and interactions
    - **COMMIT**: `git add . && git commit -m "feat: 7.1 create ReactFlow format conversion with edge aggregation and interaction support"`
    - _Requirements: 4.1, 4.2, 4.3, 7.3, 8a.4, 8a.8, 9.1, 9.2, 9.4_

  - [x] 7.2 Implement semantic tag to visual style conversion
    - Code style mapping from semantic tags to CSS properties
    - Implement node type styling and color schemes
    - Implement edge type styling and visual properties
    - Write unit tests for style application
    - **COMMIT**: `git add . && git commit -m "feat: 7.2 implement semantic tag to visual style conversion"`
    - _Requirements: 4.4_

  - [x] 7.3 Add ReactFlow data immutability and optimization
    - Implement immutable ReactFlow data generation
    - Code data structure optimization for React rendering
    - Add ReactFlow-specific performance optimizations
    - Write unit tests for data immutability and performance
    - **COMMIT**: `git add . && git commit -m "feat: 7.3 add ReactFlow data immutability and optimization"`
    - _Requirements: 4.5, 12.2_

- [x] 8. Create bridge integration tests
  - [x] 8.1 Test VisualizationState + ELKBridge integration
    - Test complete layout pipeline with paxos.json data
    - Verify container expand/collapse affects ELK layout correctly
    - Test layout configuration changes and their effects
    - Validate layout error handling and recovery
    - _Requirements: 7.2, 8.3_

  - [x] 8.2 Test VisualizationState + ReactFlowBridge integration
    - Test complete rendering pipeline with paxos.json data
    - Verify container states render correctly (collapsed vs expanded)
    - Test style application with paxos.json semantic tags
    - Validate render data immutability
    - _Requirements: 7.3, 4.2, 4.3_

  - [x] 8.3 Test end-to-end data flow through all components
    - Test complete pipeline: parse → layout → render with paxos.json
    - Verify container operations work through entire pipeline
    - Test search operations affect rendering correctly
    - Validate performance of complete pipeline
    - _Requirements: 7.1, 7.2, 7.3, 12.2_

## Phase 3: Async Coordination

- [x] 9. Implement AsyncCoordinator for queue management
  - [x] 9.1 Create sequential queue system for async operations
    - Implement queue data structure with FIFO ordering
    - Code queue processing with error handling and retry logic
    - Add queue status monitoring and reporting
    - Write unit tests for queue behavior under various conditions
    - _Requirements: 5.1, 5.4_

  - [x] 9.2 Implement ELK async operation queuing
    - Code ELK layout operation queuing with proper sequencing
    - Implement ELK operation cancellation and cleanup
    - Add ELK operation timeout handling
    - Write unit tests for ELK async operations
    - _Requirements: 5.1, 3.3_

  - [x] 9.3 Implement ReactFlow async operation queuing
    - Code ReactFlow render operation queuing with proper sequencing
    - Implement ReactFlow operation cancellation and cleanup
    - Add ReactFlow operation timeout handling
    - Write unit tests for ReactFlow async operations
    - _Requirements: 5.2, 4.1_

- [x] 10. Implement application event queuing
  - [x] 10.1 Create application event system
    - Code event types for user interactions (expand, collapse, search)
    - Implement event queuing with proper prioritization
    - Add event cancellation and cleanup mechanisms
    - Write unit tests for event system
    - _Requirements: 5.3, 8.4_

  - [x] 10.2 Integrate container operations with async coordination
    - Code container expand/collapse operations through async coordinator
    - Implement proper sequencing of container operations and layout
    - Add container operation error handling and recovery
    - Write unit tests for container operations through async system
    - _Requirements: 8.5, 5.4_

- [x] 11. Create async boundary integration tests
  - [x] 11.1 Test async coordination with paxos.json operations
    - Test rapid container expand/collapse operations with proper sequencing
    - Verify layout operations are queued and processed correctly
    - Test error recovery scenarios with paxos.json data
    - Validate performance under high async operation load
    - _Requirements: 7.2, 8.5, 12.3_

  - [x] 11.2 Test async boundary coordination
    - Test coordination between ELK and ReactFlow async boundaries
    - Verify proper sequencing when multiple boundaries are active
    - Test error propagation across async boundaries
    - Validate system stability under async stress conditions
    - _Requirements: 5.5, 5.4_

## Phase 4: Application Integration

- [x] 12. Build React components using core system
  - [x] 12.1 Create HydroscopeCore component with async coordination
    - Code React component that manages VisualizationState lifecycle
    - Implement proper React state management with async coordinator
    - Add component lifecycle management and cleanup
    - Write unit tests for React component behavior
    - _Requirements: 1.1, 6.2_

  - [x] 12.2 Implement container control components
    - Code expand/collapse buttons with proper state management
    - Implement container operation feedback and loading states
    - Add container operation error handling in UI
    - Write unit tests for container control components
    - _Requirements: 8.1, 8.2, 8.4_

- [x] 13. Implement file upload and parsing
  - [x] 13.1 Create file upload component with validation
    - Code file upload UI with drag-and-drop support
    - Implement file validation and error reporting
    - Add support for JSON file parsing and validation
    - Write unit tests for file upload component
    - _Requirements: 6.2, 7.1_

  - [x] 13.2 Integrate JSON parsing with VisualizationState
    - Code JSON parser that creates VisualizationState from paxos.json format
    - Implement hierarchyChoices parsing and default grouping selection
    - Add parsing error handling and user feedback
    - Write unit tests for JSON parsing with paxos.json
    - _Requirements: 7.1, 2.1_

- [-] 14. Implement search UI components
  - [x] 14.1 Create search input and results display
    - Code search input component with real-time feedback
    - Implement search results display with highlighting
    - Add search navigation (next/previous match) functionality
    - Write unit tests for search UI components
    - _Requirements: 9.1, 9.2_

  - [-] 14.2 Integrate search with container expansion
    - Code search result expansion of collapsed containers
    - Implement search expansion prevention of smart collapse
    - Add search result highlighting in rendered graph
    - Write unit tests for search integration
    - _Requirements: 9.3, 10.3_

- [ ] 15. Create application integration tests
  - [ ] 15.1 Test complete application with paxos.json
    - Test file upload of paxos.json through UI
    - Verify container controls work correctly with loaded data
    - Test search functionality with paxos.json nodes
    - Validate application performance and responsiveness
    - _Requirements: 7.1, 7.2, 7.4, 12.1_

  - [ ] 15.2 Test error handling and edge cases
    - Test invalid file upload scenarios
    - Test application behavior with corrupted data
    - Test UI responsiveness under high load
    - Validate error messages and user feedback
    - _Requirements: 12.4, 6.2_

## Phase 5: End-to-End Validation

- [ ] 16. Implement comprehensive Playwright tests
  - [ ] 16.1 Create browser-based paxos.json loading tests
    - Write Playwright test that loads paxos.json in browser
    - Verify visual rendering matches expected container structure
    - Test that all nodes and edges are visible and positioned correctly
    - Validate that container hierarchy is displayed properly
    - _Requirements: 7.3, 6.3_

  - [ ] 16.2 Test container expand/collapse interactions in browser
    - Write Playwright test for expand all button functionality
    - Write Playwright test for collapse all button functionality
    - Verify that container state changes are reflected visually
    - Test that node counts change correctly when containers expand/collapse
    - _Requirements: 8.1, 8.2, 8.4_

  - [ ] 16.3 Test search functionality in browser
    - Write Playwright test for search input and result highlighting
    - Test search result navigation (next/previous match)
    - Verify that search expands containers and shows hidden nodes
    - Test that search clearing removes highlights correctly
    - _Requirements: 9.1, 9.2, 9.4_

- [ ] 17. Performance testing and optimization
  - [ ] 17.1 Create performance benchmarks with paxos.json
    - Implement automated performance testing for loading paxos.json
    - Create benchmarks for layout operations with timing measurements
    - Add memory usage monitoring during graph operations
    - Write performance regression tests
    - _Requirements: 12.1, 12.2, 7.5_

  - [ ] 17.2 Optimize performance bottlenecks
    - Profile layout operations and optimize slow paths
    - Optimize ReactFlow data generation for large graphs
    - Implement caching strategies for frequently accessed data
    - Add performance monitoring and alerting
    - _Requirements: 12.5, 12.2_

- [ ] 18. Production readiness validation
  - [ ] 18.1 Comprehensive error handling validation
    - Test all error scenarios with automated tests
    - Verify graceful degradation under failure conditions
    - Test error recovery and system stability
    - Validate error messages and user experience
    - _Requirements: 12.4, 5.4_

  - [ ] 18.2 Final integration and acceptance testing
    - Run complete test suite with 100% pass rate
    - Verify all requirements are met with automated tests
    - Test system under realistic usage scenarios
    - Validate that Kiro can maintain and extend the system autonomously
    - _Requirements: 6.1, 6.2, 11.5_

## Git Commit Instructions for Remaining Tasks

**For ALL tasks not explicitly marked with COMMIT instructions above:**

After completing each task (including all sub-tasks), run:

```bash
git add .
git commit -m "feat: [task-number] [brief description of what was implemented]"
```

**Examples:**

- `git commit -m "feat: 8.1 test VisualizationState + ELKBridge integration"`
- `git commit -m "feat: 9.2 implement ELK async operation queuing"`
- `git commit -m "feat: 12.1 create HydroscopeCore component with async coordination"`
- `git commit -m "feat: 16.2 test container expand/collapse interactions in browser"`

**Important:** Never skip commits. Each completed task should have its own commit to ensure progress is tracked and recoverable.

## Success Criteria

- All tests pass with >95% code coverage
- Paxos.json loads and renders correctly in browser
- Container expand/collapse operations work reliably
- Search functionality works with proper container expansion
- Performance meets acceptable benchmarks
- System is maintainable and extensible by Kiro autonomously
- **All tasks have corresponding git commits with clear messages**
