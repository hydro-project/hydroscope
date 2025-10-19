# Enabling Edge Styles in Existing Data Files

## Quick Start

To enable double-line and wavy-line rendering in your existing Hydroscope JSON files, you need to add **semantic mappings** to your legend.

## Example: Enabling Double Lines for KeyedStream

If your data file has edges like this:

```json
{
  "edges": [
    {
      "id": "e1",
      "source": "n1",
      "target": "n2",
      "semanticTags": ["KeyedStream"]
    }
  ]
}
```

Add this to your legend:

```json
{
  "legend": {
    "semanticMappings": {
      "KeyedStream": {
        "line-style": "double"
      }
    }
  }
}
```

## Common Semantic Mappings

### For Keyed Streams (Double Lines)

```json
{
  "legend": {
    "semanticMappings": {
      "KeyedStream": {
        "line-style": "double"
      },
      "Keyed": {
        "line-style": "double"
      }
    }
  }
}
```

### For Cycles/Feedback (Wavy Lines)

```json
{
  "legend": {
    "semanticMappings": {
      "Cycle": {
        "waviness": "wavy"
      },
      "Feedback": {
        "waviness": "wavy"
      }
    }
  }
}
```

### For Keyed Cycles (Double Wavy Lines)

```json
{
  "legend": {
    "semanticMappings": {
      "KeyedCycle": {
        "line-style": "double",
        "waviness": "wavy"
      }
    }
  }
}
```

## Complete Example

Here's a complete example showing all edge styles:

```json
{
  "nodes": [
    { "id": "n1", "nodeType": "Source", "shortLabel": "source" },
    { "id": "n2", "nodeType": "Transform", "shortLabel": "transform" },
    { "id": "n3", "nodeType": "Sink", "shortLabel": "sink" }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "n1",
      "target": "n2",
      "semanticTags": ["NormalStream"]
    },
    {
      "id": "e2",
      "source": "n2",
      "target": "n3",
      "semanticTags": ["KeyedStream"]
    }
  ],
  "legend": {
    "title": "Stream Types",
    "semanticMappings": {
      "NormalStream": {
        "line-style": "single"
      },
      "KeyedStream": {
        "line-style": "double"
      }
    },
    "items": [
      { "label": "Normal Stream", "type": "NormalStream" },
      { "label": "Keyed Stream", "type": "KeyedStream" }
    ]
  }
}
```

## Updating chat2.json

The file `test-data/chat2.json` has edges with `semanticTags: ["KeyedStream"]` but no semantic mappings. To enable double-line rendering:

1. Open `test-data/chat2.json`
2. Find the `"legend"` section (currently at the end of the file)
3. Add a `"semanticMappings"` section:

```json
{
  "legend": {
    "semanticMappings": {
      "KeyedStream": {
        "line-style": "double"
      },
      "Keyed": {
        "line-style": "double"
      }
    },
    "items": [
      { "label": "Source", "type": "Source" },
      { "label": "Transform", "type": "Transform" },
      ...
    ],
    "title": "Node Types"
  }
}
```

## Available Visual Channels

The following visual channels are supported for edges:

### line-style

- `"single"` - Normal single line (default)
- `"double"` - Two parallel lines (for keyed streams)

### waviness

- `"none"` - Straight line (default)
- `"wavy"` - Sine wave path (for cycles/feedback)

### line-pattern

- `"solid"` - Continuous line (default)
- `"dashed"` - Dashed line
- `"dotted"` - Dotted line
- `"dash-dot"` - Dash-dot pattern

### animation

- `"static"` - No animation (default)
- `"animated"` - Flowing animation

### line-width

- `1` - Thin line
- `2` - Normal line (default)
- `3` - Thick line
- `4` - Very thick line

## Combining Multiple Properties

You can combine multiple visual channels:

```json
{
  "legend": {
    "semanticMappings": {
      "ImportantKeyedStream": {
        "line-style": "double",
        "line-width": 3,
        "animation": "animated"
      },
      "CyclicFlow": {
        "waviness": "wavy",
        "line-pattern": "dashed",
        "animation": "animated"
      }
    }
  }
}
```

## Testing Your Changes

1. **Start dev server**:

   ```bash
   npm run dev
   ```

2. **Load your updated JSON file** in the Hydroscope UI

3. **Verify edge rendering**:
   - Single lines: Should appear as one line
   - Double lines: Should appear as two parallel lines ~2px apart
   - Wavy lines: Should appear as sine waves
   - Double wavy: Should appear as two parallel wavy lines

## Troubleshooting

### Edges still render as single lines

**Problem**: Semantic mappings not applied
**Solution**:

- Check that semantic tag in edge matches key in semanticMappings
- Case-sensitive: "KeyedStream" ≠ "keyedstream"
- Verify JSON is valid (use a JSON validator)

### Wavy lines look straight

**Problem**: waviness value incorrect
**Solution**:

- Use `"waviness": "wavy"` not `"waviness": true`
- Check spelling of "waviness"

### Double lines look weird

**Problem**: May be combined with incompatible strokeDasharray
**Solution**:

- Don't use `"line-pattern": "dotted"` with double lines
- Use solid or dashed patterns only

## Migration Guide

### From Old Hydroscope (pre-v1.0)

If you have old data files that used filter-based styling:

**Old format** (no longer supported):

```json
{
  "edges": [
    {
      "id": "e1",
      "filter": "edge-double-line"
    }
  ]
}
```

**New format**:

```json
{
  "edges": [
    {
      "id": "e1",
      "semanticTags": ["DoubleLineEdge"]
    }
  ],
  "legend": {
    "semanticMappings": {
      "DoubleLineEdge": {
        "line-style": "double"
      }
    }
  }
}
```

### Best Practices

1. **Use descriptive semantic tag names**:
   - ✅ Good: "KeyedStream", "CyclicDependency", "AsyncMessage"
   - ❌ Bad: "edge1", "type2", "special"

2. **Document your semantic tags in legend items**:

   ```json
   {
     "legend": {
       "items": [
         {
           "label": "Keyed Stream (preserves keys)",
           "type": "KeyedStream"
         }
       ]
     }
   }
   ```

3. **Be consistent across files**:
   - If you use "KeyedStream" in one file, use it in all files
   - Consider creating a shared semantic tag vocabulary

4. **Test with edge-styles-test.json first**:
   - Load `test-data/edge-styles-test.json` to see all styles working
   - Use it as a reference for your own mappings

## Reference Files

- **Test file with all styles**: `test-data/edge-styles-test.json`
- **Implementation plan**: `docs/development/edge-styling-implementation-plan.md`
- **Implementation summary**: `docs/development/edge-styling-implementation-summary.md`
- **Source code**: `src/render/CustomEdge.tsx`
