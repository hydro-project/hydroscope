# Example Docusaurus Usage

Here are examples of how to use Hydroscope in your Docusaurus documentation:

## 1. Simple Demo

```jsx
import { HydroscopeDemo } from '@hydro-project/hydroscope';

<HydroscopeDemo height={400} />
```

## 2. Paxos Demo with Controls

```jsx
import { HydroscopeDemo } from '@hydro-project/hydroscope';

<HydroscopeDemo height={600} showPaxosDemo={true} />
```

## 3. Custom Data Visualization

```jsx
import { HydroscopeDocusaurus } from '@hydro-project/hydroscope';

const customData = {
  nodes: [
    {
      id: 'source1',
      shortLabel: 'source',
      fullLabel: 'source_iter([1, 2, 3])',
      nodeType: 'Source',
      data: { locationId: 0, locationType: 'Process' }
    },
    {
      id: 'map1',
      shortLabel: 'map',
      fullLabel: 'map(|x| x * 2)',
      nodeType: 'Transform',
      data: { locationId: 0, locationType: 'Process' }
    },
    {
      id: 'sink1',
      shortLabel: 'sink',
      fullLabel: 'for_each(|x| println!("{}", x))',
      nodeType: 'Sink',
      data: { locationId: 1, locationType: 'Process' }
    }
  ],
  edges: [
    {
      id: 'e1',
      source: 'source1',
      target: 'map1',
      semanticTags: ['Unbounded', 'TotalOrder']
    },
    {
      id: 'e2',
      source: 'map1',
      target: 'sink1',
      semanticTags: ['Unbounded', 'TotalOrder']
    }
  ],
  hierarchyChoices: [
    {
      id: 'location',
      name: 'Location',
      children: [
        { id: 'loc_0', name: 'Process 0', children: [] },
        { id: 'loc_1', name: 'Process 1', children: [] }
      ]
    }
  ],
  nodeAssignments: {
    location: {
      'source1': 'loc_0',
      'map1': 'loc_0',
      'sink1': 'loc_1'
    }
  }
};

<HydroscopeDocusaurus 
  data={customData}
  height={500}
  showControls={true}
  showMiniMap={true}
/>
```

## 4. Minimal Configuration

```jsx
import { HydroscopeDocusaurus } from '@hydro-project/hydroscope';

<HydroscopeDocusaurus 
  demo={true}
  height={300}
  showControls={false}
  showMiniMap={false}
  showBackground={false}
/>
```

## Installation in Docusaurus

1. Install the package:
```bash
npm install @hydro-project/hydroscope
```

2. In your Docusaurus MDX file:
```mdx
---
title: My Documentation Page
---

import { HydroscopeDemo } from '@hydro-project/hydroscope';

# My Documentation

Here's an interactive Hydroscope visualization:

<HydroscopeDemo height={400} />

The visualization shows...
```

## Styling

The components automatically adapt to Docusaurus themes. You can customize with CSS:

```css
.hydroscope-docusaurus {
  border: 2px solid var(--ifm-color-primary);
  border-radius: 12px;
}

.hydroscope-demo-controls {
  background: var(--ifm-color-emphasis-100);
}
```