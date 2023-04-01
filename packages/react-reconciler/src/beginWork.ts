// packages/react-reconciler/src/ReactFiberBeginWork.new.js

// Fiber树的构建是深度优先遍历。
// 这是个递归的过程，存在递、归两个阶段：
// 递：对应beginWork
// 归：对应completeWork

import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { reconcileChildFibers, mountChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';

// 递归中的递阶段，寻找和处理子fiberNode
export const beginWork = (wip: FiberNode) => {
	// 子fiberNode

	switch (wip.tag) {
		case HostRoot: // 根节点
			return updateHostRoot(wip);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText: // HostText没有beginWork工作流程（因为他没有子节点)
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}

	return null;
};

// HostRoot的beginWork工作流程：
// 1.计算状态的最新值
// 2.创建子fiberNode

function updateHostRoot(wip: FiberNode) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;

	// 1.计算状态的最新值（同时也是消费update）
	const { memoizedState } = processUpdateQueue(baseState, pending);
	wip.memoizedState = memoizedState; // 对于HostRoot，memoizedState 为 App element

	// 2.创建子fiberNode
	const nextChildren = wip.memoizedState;
	reconcileChildren(wip, nextChildren);
	return wip.child; // 即<App />
}

// HostComponent的beginWork工作流程:
// 1.创造子fiberNode
// <div> <span><span> </div>
// 对于 div FiberNode，其 nextChildren 为 props.children （span）
function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;

	reconcileChildren(wip, nextChildren);
	return wip.child;
}

// 就是diff current 和 新element 后打 flag 标签，后续 commit 时要依据 flag 来操作dom
// 并且生成对应 wip fiberNode.
function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate;

	if (current !== null) {
		// 更新
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount
		wip.child = mountChildFibers(wip, null, children);
	}
}

function updateFunctionComponent(wip: FiberNode) {
	const nextChildren = renderWithHooks(wip); // 对于函数组件，其children为函数的执行返回结果
	reconcileChildren(wip, nextChildren);
	return wip.child;
}
