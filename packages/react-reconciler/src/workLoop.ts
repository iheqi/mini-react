import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInprogress } from './fiber';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null; // 当前工作的 fiber

function prepareRefreshStack(root: FiberRootNode) {
	workInProgress = createWorkInprogress(root.current, {});
}
// 调度功能
export function scheduleUpdateOnFiber(fiber: FiberNode) {
	// 传进来的fiber可能是子节点，需要向上寻找到 FiberRoot 再进行调度
	// （为什么每次都要寻找，将 FiberRoot 保存为全局变量不行吗）
	const root = markUpdateFromToRoot(fiber);

	renderRoot(root);
}

// 寻找 FiberRoot
function markUpdateFromToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;

	while (parent !== null) {
		node = parent;
		parent = node.return;
	}

	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

function renderRoot(root: FiberRootNode) {
	prepareRefreshStack(root);

	do {
		try {
			workLoop();
		} catch (error) {
			if (__DEV__) {
				console.warn('workLoop发生错误', error);
			}
			workInProgress = null;
		}
	} while (true);

	// 完成 wip fiber 树的构建后，进行 commitRoot
	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;

	// wip fiberNode树，树中的Flags
	commitRoot(root);
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitWork(workInProgress);
	}
}

function performUnitWork(fiber: FiberNode) {
	const next = beginWork(fiber); // 返回 子fiber 或 null（没有子节点了）

	fiber.memoizedProps = fiber.pendingProps;

	if (next === null) {
		// 如果没有子节点，则遍历兄弟节点
		comleteUnitWork(fiber);
	} else {
		workInProgress = next; // 有子节点，遍历子节点
	}
}

function comleteUnitWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;
	do {
		completeWork(node);

		const sibling = node.sibling;

		if (sibling !== null) {
			// 有兄弟节点，遍历兄弟节点
			workInProgress = sibling;
			return;
		} else {
			// 否则向上遍历父节点
			node = node.return;
			workInProgress = node;
		}
	} while (node !== null);
}
