# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Save button in CustomControls with export dialog for PNG and JSON formats
- Modal dialog for choosing export format (PNG image or JSON data)
- Automatic filename generation based on uploaded file or default name

## [1.0.2] - 2024-10-20

### Added

- Custom edge rendering with hash-marks (dots) and wavy-line support
- Automatic viewport focus on first search result
- Search result centering and zooming functionality
- Shared Spinner component for consistent loading UI
- Enhanced edge styling with semantic colors and improved spacing

### Fixed

- EdgeStyleLegend now renders hash marks as circles (matching CustomEdge implementation)
- Fixed "Show full node labels" toggle and HierarchyTree expansion
- Fixed eyeball icon appearing on leaf nodes and hierarchy change crash
- Fixed visibility controls regression
- Fixed fitView to wait for all nodes to be measured before executing
- Fixed all failing test suite issues (41 → 0 failures)
- Fixed StyleTuner control updates and container color consistency
- Fixed search results to sort by hierarchy tree order
- Fixed viewport positioning for container expand/collapse in AutoFit mode
- Fixed search regression and performance issues
- Fixed search race condition by waiting for React render before navigation
- Fixed navigation highlights not clearing when clearing search
- Fixed tree/graph desync during search with DRY expansion logic
- Fixed search highlighting broken by flawed performance optimization
- Fixed AsyncCoordinator queue deadlock and completed queue enforcement

### Changed

- Made Edge and Node legends fully data-driven from JSON
- Made AsyncCoordinator fully event-driven
- Removed legacy `search()` API and tests
- Popups now only show when clicking on info icon
- Removed all console.log statements, using hscopeLogger instead
- Improved expanded container labels appearance
- Cleaner wavy line rendering

### Documentation

- Major documentation overhaul with embedding guides and JSON format spec

## [1.0.1] - 2024-10-16

### Fixed

- Removed unused ReactDOM import causing lint errors
- Fixed import paths in performance test suite
- Applied prettier formatting across codebase

### Changed

- Moved slow InfoPanel search test to performance suite to prevent CI timeouts
- Updated performance test structure for better organization

## [1.0.0] - 2024-10-16

### Added

- Initial public release of @hydro-project/hydroscope
- React-based graph visualization component with ELK layout engine
- Hierarchical container support with smart collapse/expand
- Interactive info panels with DOM-based positioning
- Search and navigation features
- Hierarchy tree view
- Full TypeScript support
- Comprehensive test suite

### Features

- Auto-close popups on canvas pan/zoom
- Accurate popup positioning using getBoundingClientRect()
- Configurable layout options via ELK bridge
- Bulk operations with atomicity guarantees
- Error boundary for robust error handling
- Performance testing suite

[1.0.2]: https://github.com/hydro-project/hydroscope/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/hydro-project/hydroscope/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/hydro-project/hydroscope/releases/tag/v1.0.0
