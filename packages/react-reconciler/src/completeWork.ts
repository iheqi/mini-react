// Fiber树的构建是深度优先遍历。
// 这是个递归的过程，存在递、归两个阶段：
// 递：对应beginWork，主要的工作是创建或复用子fiber节点（reconcileChildren、Diff），以及打flag
// 归：对应completeWork，主要工作是更新fiber的props、创建dom、收集flag
// 都是DFS中的流程，做的事情都差不多，为什么还分上下啊。。。

import {
	appendInitialChild,
	Container,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';
import { FiberNode } from './fiber';
import { NoFlags, Update } from './fiberFlags';
import {
	HostRoot,
	HostText,
	HostComponent,
	FunctionComponent,
	Fragment
} from './workTags';

// 递归中的归阶段，寻找和处理父fiberNode
export const completeWork = (wip: FiberNode) => {
	// 递归中的归

	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
				// 1. props是否变化 {onClick: xx} {onClick: xxx}
				// 2. 变了 Update flag
				// className style
				updateFiberProps(wip.stateNode, newProps);
			} else {
				// const instance = createInstance(wip.type, newProps);
				const instance = createInstance(wip.type, newProps); // 创建DOM
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					markUpdate(wip);
				}
			} else {
				const instance = createTextInstance(newProps.content);
				// appendAllChildren(instance, wip); // 对于 HostText，不存在 child
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot: // 根节点
		case FunctionComponent:
		case Fragment:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('completeWork未实现的类型');
			}
			break;
	}
};

function appendAllChildren(parent: Container, wip: FiberNode) {
	let node = wip.child;
	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node.stateNode);
		} else if (node.child !== null) {
			// 向下遍历
			node.child.return = node;
			node = node.child;
			continue;
		}

		// 终止条件，从下到上完了
		if (node === wip) {
			return;
		}
		// 向上递归
		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

// complete性能优化，在commit时，如果再深度遍历一遍fiber树来根据 flag 进行更新，会耗费性能。
// 因此在 complete 就将子fiberNode发flags收集到父fiberNode中（类似Vue中的 patchFlag、Block）
// 这样通过判断父 fiber 有没有 Flags 就知道子树是否需要遍历渲染

const bubbleProperties = (wip: FiberNode) => {
	let subtreeFlags = NoFlags;
	let child = wip.child;
	while (child !== null) {
		subtreeFlags |= child.subtreeFlags; // 通过位运算收集
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}
	wip.subtreeFlags |= subtreeFlags;
};

function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update;
}
