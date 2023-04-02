import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInprogress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
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
			break;
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

// - commit 阶段
//   - beforeMutation 阶段
//   - mutation 阶段
//   - layout 阶段
function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}

	// 重置
	root.finishedWork = null;

	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	// 如果没有flag，则不用更新
	if (subtreeHasEffect || rootHasEffect) {
		//   - beforeMutation 阶段
		//   - mutation 阶段
		commitMutationEffects(finishedWork);
		root.current = finishedWork; // 把workInProgress Fiber切换成current Fiber
		//   - layout 阶段
	} else {
		root.current = finishedWork; // 把workInProgress Fiber切换成current Fiber
	}
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
		completeUnitWork(fiber);
	} else {
		workInProgress = next; // 有子节点，遍历子节点
	}
}

function completeUnitWork(fiber: FiberNode) {
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
