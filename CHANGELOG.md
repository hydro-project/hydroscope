# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.1]: https://github.com/hydro-project/hydroscope/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/hydro-project/hydroscope/releases/tag/v1.0.0
