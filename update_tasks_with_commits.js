const fs = require('fs');

// Read the tasks file
const tasksPath = '.kiro/specs/hydroscope-rewrite/tasks.md';
let content = fs.readFileSync(tasksPath, 'utf8');

// Define patterns to match task lines and add commit instructions
const taskPatterns = [
  // Phase 2 tasks
  { pattern: /(\s+- \[ \] 7\.1 Create ReactFlow format conversion from VisualizationState\n(?:\s+- [^\n]+\n)*\s+- Write unit tests for ReactFlow conversion with paxos\.json data\n)(\s+- _Requirements:)/, replacement: '$1    - **COMMIT**: `git add . && git commit -m "feat: 7.1 create ReactFlow format conversion from VisualizationState"`\n$2' },
  { pattern: /(\s+- \[ \] 7\.2 Implement semantic tag to visual style conversion\n(?:\s+- [^\n]+\n)*\s+- Write unit tests for style application\n)(\s+- _Requirements:)/, replacement: '$1    - **COMMIT**: `git add . && git commit -m "feat: 7.2 implement semantic tag to visual style conversion"`\n$2' },
  { pattern: /(\s+- \[ \] 7\.3 Add ReactFlow data immutability and optimization\n(?:\s+- [^\n]+\n)*\s+- Write unit tests for data immutability and performance\n)(\s+- _Requirements:)/, replacement: '$1    - **COMMIT**: `git add . && git commit -m "feat: 7.3 add ReactFlow data immutability and optimization"`\n$2' },
  { pattern: /(\s+- \[ \] 8\.1 Test VisualizationState \+ ELKBridge integration\n(?:\s+- [^\n]+\n)*\s+- Validate layout error handling and recovery\n)(\s+- _Requirements:)/, replacement: '$1    - **COMMIT**: `git add . && git commit -m "feat: 8.1 test VisualizationState + ELKBridge integration"`\n$2' },
  { pattern: /(\s+- \[ \] 8\.2 Test VisualizationState \+ ReactFlowBridge integration\n(?:\s+- [^\n]+\n)*\s+- Validate render data immutability\n)(\s+- _Requirements:)/, replacement: '$1    - **COMMIT**: `git add . && git commit -m "feat: 8.2 test VisualizationState + ReactFlowBridge integration"`\n$2' },
  { pattern: /(\s+- \[ \] 8\.3 Test end-to-end data flow through all components\n(?:\s+- [^\n]+\n)*\s+- Validate performance of complete pipeline\n)(\s+- _Requirements:)/, replacement: '$1    - **COMMIT**: `git add . && git commit -m "feat: 8.3 test end-to-end data flow through all components"`\n$2' },
];

// Apply all patterns
taskPatterns.forEach(({ pattern, replacement }) => {
  content = content.replace(pattern, replacement);
});

// Write back to file
fs.writeFileSync(tasksPath, content);
console.log('Updated tasks.md with commit instructions');