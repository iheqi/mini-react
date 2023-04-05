export type WorkTag = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Fiber.tag: 即 fiber 的类型，
export const FunctionComponent = 0;
export const ClassComponent = 1;
export const IndeterminateComponent = 2; // Before we know whether it is function or class
export const HostRoot = 3; // 挂载的根节点，id="app"
export const HostPortal = 4; // A subtree. Could be an entry point to a different renderer.
export const HostComponent = 5; // 比如<div>
export const HostText = 6;
export const Fragment = 7;
