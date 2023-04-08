import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import {
	FiberNode,
	FiberRootNode,
	createWorkInProgress,
	pendingPassiveEffects
} from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { addScheduleSyncCallback, flushSyncCallbacks } from './syncTaskQueue';
import { HostRoot } from './workTags';

import {
	unstable_scheduleCallback as schedulerCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

let workInProgress: FiberNode | null = null; // 当前工作的 fiber
let wipRootRenderLane: Lane = NoLane; // 当前工作的lane
let rootDoseHasPassiveEffects = false;

type RootExitStatus = number;
// render中断
const RootInComplete = 1;
// render完成
const RootCompleted = 2;

function prepareRefreshStack(root: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}

// 调度功能
// 有update操作就会调用 scheduleUpdateOnFiber，开启render和commit，即使没有DOM的更改。（太搞笑了）

// scheduleUpdateOnFiber => ensureRootIsScheduled（performSyncWorkOnRoot || performConcurrentWorkOnRoot）
// => (workLoop || workLoopConcurrent) => performUnitWork => beginWork => completeWork
// 完成 wip fiber 树的构建后进行 commitRoot

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// 传进来的fiber可能是子节点，需要向上寻找到 FiberRoot 再进行调度
	// （为什么每次都要寻找，将 FiberRoot 保存为全局变量不行吗）
	const root = markUpdateFromToRoot(fiber);
	markRootUpdate(root, lane);

	// performSyncWorkOnRoot(root); // 之前是同步执行，改为按优先级异步调度执行
	ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root: FiberRootNode) {
	// 这里只调度了优先级最高的lane，那后续lane如何再继续执行？
	// renderRoot会继续调用 ensureRootIsScheduled
	const updateLane = getHighestPriorityLane(root.pendingLanes);

	if (updateLane === NoLane) {
		return;
	}
	if (updateLane === SyncLane) {
		// 同步优先级，用微任务调度。。。

		if (__DEV__) {
			console.log('在微任务中调度，优先级:', updateLane);
		}

		// [performSyncWorkOnRoot, performSyncWorkOnRoot, performSyncWorkOnRoot]
		addScheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级，用宏任务调用
		const schedulerPriority = lanesToSchedulerPriority(updateLane);
		schedulerCallback(
			schedulerPriority,
			// @ts-ignore
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}
}

// 记录Lane
function markRootUpdate(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
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

// 同步render
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	// 这里说ensureRootIsScheduled只调度了优先级最高的lane，那后续lane如何再继续执行？
	// renderRoot会继续调用 ensureRootIsScheduled（那这逻辑也应该放到最后啊。。。不然当前微任务都还没执行，说的啥玩意啊）
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		// 其他比SyncLane低的优先级
		ensureRootIsScheduled(root);
		return;
	}

	if (__DEV__) {
		console.warn('render阶段开始');
	}

	// 初始化
	prepareRefreshStack(root, lane);

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
	root.finishedLane = lane;
	wipRootRenderLane = NoLane;

	// wip fiberNode树，树中的Flags
	// commit阶段
	commitRoot(root);
}

// 异步可中断的 Concurrent
function performConcurrentWorkOnRoot(root: FiberRootNode, didTimeout: boolean) {
	const lane = getHighestPriorityLane(root.pendingLanes);

	if (lane === NoLane) {
		return null;
	}
	// 完成 wip fiber 树的构建后，进行 commitRoot
	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;
	root.finishedLane = lane;
	wipRootRenderLane = NoLane;

	// wip fiberNode树，树中的Flags
	// commit阶段
	commitRoot(root);
	const needSync = lane === SyncLane || didTimeout;
}

// performSyncWorkOnRoot 和 performConcurrentWorkOnRoot最后都要调用renderRoot
function renderRoot(
	root: FiberRootNode,
	lane: Lane,
	shouldTimeSlice: boolean
): RootExitStatus {
	if (__DEV__) {
		console.warn('render阶段开始');
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}render阶段`, root);
	}

	// 初始化，如果是中断继续执行，wipRootRenderLane === lane，无需再初始化
	if (wipRootRenderLane !== lane) {
		prepareRefreshStack(root, lane);
	}

	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoop();
			break;
		} catch (error) {
			if (__DEV__) {
				console.warn('workLoop发生错误', error);
			}
			workInProgress = null;
		}
	} while (true);

	// workLoopConcurrent被中断后继续执行
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete;
	}
	// workLoop 或 workLoopConcurrent 执行完成

	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error('render阶段结束时wip应该为null');
	}
	return RootCompleted;
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitWork(workInProgress);
	}
}

function workLoopConcurrent() {
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitWork(workInProgress);
	}
}

function performUnitWork(fiber: FiberNode) {
	const next = beginWork(fiber, wipRootRenderLane); // beginWork: 返回 子fiber 或 null（没有子节点了）

	fiber.memoizedProps = fiber.pendingProps;

	if (next === null) {
		// completeWork: 如果没有子节点，则遍历兄弟节点和父节点
		completeUnitWork(fiber);
	} else {
		workInProgress = next; // 有子节点，遍历子节点
	}
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
	const lane = root.finishedLane;

	if (lane === NoLane && __DEV__) {
		console.error('commit阶段finishedLane不应该是NoLane');
	}

	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;

	markRootFinished(root, lane);

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoseHasPassiveEffects) {
			rootDoseHasPassiveEffects = true;
			// 调度副作用
			schedulerCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	// 如果没有flag，则不用更新
	if (subtreeHasEffect || rootHasEffect) {
		// - beforeMutation 阶段
		// - mutation 阶段
		commitMutationEffects(finishedWork, root);
		root.current = finishedWork; // 把workInProgress Fiber切换成current Fiber
		// - layout 阶段
	} else {
		root.current = finishedWork; // 把workInProgress Fiber切换成current Fiber
	}

	rootDoseHasPassiveEffects = false;
	ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: pendingPassiveEffects) {
	// 首先触发所有unmount 时的 destroy effect，且对于某个fiber,如果触发了unmount destroy，本次更新不会再触发update create
	pendingPassiveEffects.unmount.forEach((effect) => {
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];

	// 触发所有上次更新的destroy（更新也会触发destroy？？？）
	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});

	// 触发所有这次更新的create
	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];
	flushSyncCallbacks();
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
