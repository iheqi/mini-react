// packages/react-reconciler/src/ReactFiberFlags.js
// fiber flag。标记fiber操作，后续根据flag进行修改

export type Flags = number;

export const NoFlags = 0b0000000;
export const Placement = 0b0000001; // 更新组件
export const Update = 0b0000010; // 更新props
export const ChildDeletion = 0b0000100; // 删除子节点

export const PassiveEffect = 0b0001000; // 需要执行effect

export const MutationMask = Placement | Update | ChildDeletion; // 用于判断是否要执行 commit 的 mutation 阶段

export const PassiveMask = PassiveEffect | ChildDeletion; // 用于判断是否要执行 effect，包括unmount时的销毁回调函数
