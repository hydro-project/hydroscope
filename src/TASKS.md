TASKS:
- spinner covering up rendering
- ✅ efficiency of rendering and esp. search on big files - IMPLEMENTED performance instrumentation system with:
  - Automatic profiling for large files (>100KB)
  - Real-time performance dashboard showing timing breakdowns
  - Memory usage tracking  
  - Bottleneck identification and optimization recommendations
  - Specific analysis tools for paxos.json (748KB, 459 nodes, 493 edges)
  - Instrumented FileDropZone, JSONParser, HydroscopeCore, and FlowGraph components
  - Browser console tools for manual performance analysis

- MRTree tends to line up nodes vertically or horizontally (see first screenshot). The result is that lines occlude each other (see 2nd screenshot after I drag). Is there a way to convince MRTree to stagger the spacing so that it doesn't do that?
- remove vestiges of multiple handle strategies (CURRENT_HANDLE_STRATEGY) and floating edges (FloatingEdges.tsx)
- consolidate tests
- sizing of intermediate containers
- cleanly remove upload/uploadEndpoint.js