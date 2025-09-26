// Re-export the main branch render components
export { StandardNode, MemoStandardNode } from '../../render/StandardNode';
export { ContainerNode, MemoContainerNode } from '../../render/ContainerNode';

import { MemoStandardNode as StandardNodeComp } from '../../render/StandardNode';
import { MemoContainerNode as ContainerNodeComp } from '../../render/ContainerNode';

export const nodeTypes = {
  default: StandardNodeComp,
  standard: StandardNodeComp,
  container: ContainerNodeComp,
};