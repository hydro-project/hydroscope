# Hydroscope Documentation

Welcome to the Hydroscope documentation! This directory contains comprehensive guides for developers working on or with Hydroscope.

## 📚 Table of Contents

### Getting Started

- **[Embedding Hydroscope](EMBEDDING.md)** - Complete guide for embedding the high-level component
- **[Embedding HydroscopeCore](EMBEDDING_CORE.md)** - Advanced guide for maximum customization
- **[JSON Format Specification](JSON_FORMAT.md)** - Complete guide to the graph data format

### Development Guides

#### Architecture & Design

- **[Bridge Reset Architecture](development/bridge-reset-architecture.md)** - Overview of the bridge pattern and reset architecture
- **[Sync Tree and Graph](development/sync-tree-and-graph.md)** - How hierarchy tree and graph views stay synchronized

#### Implementation Guides

- **[Logging Guide](development/LOGGING.md)** - Logging patterns and debugging strategies
- **[ResizeObserver Error Fix](development/ResizeObserver-Error-Fix.md)** - Handling ResizeObserver loop errors
- **[Simplified API Examples](development/simplified-api-examples.md)** - Common API usage patterns and examples

## 🚀 Quick Links

- [Main README](../README.md) - Package overview and quick start
- [Performance Tests](../src/__tests__/performance/README.md) - Performance testing documentation
- [CHANGELOG](../CHANGELOG.md) - Version history and release notes

## 📝 Contributing to Documentation

When adding new documentation:

1. Place architecture/design docs in `development/`
2. Use clear, descriptive filenames
3. Add entry to this index
4. Follow existing markdown formatting conventions
5. Include code examples where helpful

## 🏗️ Project Structure

```
docs/
├── README.md (this file)
└── development/
    ├── bridge-reset-architecture.md
    ├── LOGGING.md
    ├── ResizeObserver-Error-Fix.md
    ├── simplified-api-examples.md
    └── sync-tree-and-graph.md
```

## Printing out hscopeLogger messages

Type the following into the web console:

```
window.__HYDRO_LOGS = 'coordinator,bridge,op,layout,interaction,debug,search,container,style,performance,panel,validation'
```

## 💡 Additional Resources

- [GitHub Repository](https://github.com/hydro-project/hydroscope)
- [npm Package](https://www.npmjs.com/package/@hydro-project/hydroscope)
- [Hydro Project](https://github.com/hydro-project)
