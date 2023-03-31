import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { FiberNode } from './fiber';

let workInProgress: FiberNode | null = null; // 当前工作的 fiber

function prepareRefreshStack(fiber: FiberNode) {
	workInProgress = fiber;
}

function renderRoot(root: FiberNode) {
	prepareRefreshStack(root);

	do {
		try {
			workLoop();
		} catch (error) {
			console.warn('workLoop发生错误', error);
			workInProgress = null;
		}
	} while (true);
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
