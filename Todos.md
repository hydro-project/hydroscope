## Let's get ready for production by removing or systematically suppressing all console.log messages from the app, and making sure that when the tests are clean they are not noisy. What are the canonical/idiomatic ways to do this? Is the right thing to remove all the console.log statements?

HierarchyTree additions:

1. Centering via click: I'd like each label in the hierarchy tree to be clickable. When I click on it, the corresponding container or graphnode should be centered in the ReactFlow view, and zoomed to the native size of its font.
2. Visibility controls. I'd like each line in the hierarchy tree to have an "eye" icon toggle next to it. When the eye is "open", the corresponding Container or GraphNode should be visible in ReactFlow. When the eye is "closed", the corresponding Container or GraphNode should be made nearly transparent and its adjacent edges also made very light.

---

I'd like you to identify opportunities to refactor our code for readability and simplicity. Particularly I'd like the core to be clean and easy to read.

While we're doing that I'd like also to reinforce our architectural design:

- sequential core with React/asynchrony only in components. Can that be enforced by not including/allowing React in some subdirs?
- all state in VisualizationState, with stateless bridges.

This may mean breaking apart the VisualizationState.tsx file. But if we're going to do that, we need to isolate the stateful code in its own directory and clearly separate out all the stateless code.

--
I'm concerned about fallback logic hiding bugs in our code. Let's do a TDD-based sweep of all fallback logic. For each fallback we consider removing, we should replace it with an error and have a regression test that exercises that code to make sure it doesn't run into the error.

--
Let's remove the use of `any` from Hydroscope, and make sure we have proper types throughout.
