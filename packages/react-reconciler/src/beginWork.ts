// packages/react-reconciler/src/ReactFiberBeginWork.new.js

// Fiber树的构建是深度优先遍历。
// 这是个递归的过程，存在递、归两个阶段：
// 递：对应beginWork
// 归：对应completeWork

import { FiberNode } from './fiber';

// 递归中的递阶段，寻找和处理子fiberNode
export const beginWork = (fiber: FiberNode) => {
	// 子fiberNode
};
