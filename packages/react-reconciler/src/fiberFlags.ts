// packages/react-reconciler/src/ReactFiberFlags.js

export type Flags = number;

export const NoFlags = 0b0000001;
export const Placement = 0b0000010; // 更新组件
export const Update = 0b0000100; // 更新props
export const ChildDeletion = 0b0001000; // 删除子节点

export const MutationMask = Placement | Update | ChildDeletion; // 用于判断是否要执行 commit 的 mutation 阶段
