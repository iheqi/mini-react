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
	unstable_shouldYield,
	unstable_cancelCallback
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
	root.finishedLane = NoLane;
	root.finishedWork = null;
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}

// 调度功能
// 有update操作就会调用 scheduleUpdateOnFiber，开启render和commit，即使没有DOM的更改。（太搞笑了）

// 更新流程：
// setState => scheduleUpdateOnFiber => ensureRootIsScheduled（performSyncWorkOnRoot || performConcurrentWorkOnRoot）
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
	// performSyncWorkOnRoot 会继续调用 ensureRootIsScheduled
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	const existingCallback = root.callbackNode;

	// 优先级策略逻辑
	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			// 1.没有work
			unstable_cancelCallback(existingCallback);
		}
		root.callbackNode = null;
		root.callbackPriority = NoLane;
		return;
	}

	// 2.同优先级。无需开启新调度，performConcurrentWorkOnRoot调度完了会递归调用performConcurrentWorkOnRoot
	const curPriority = updateLane;
	const prevPriority = root.callbackPriority;

	// existingCallbackPriority === newCallbackPriority
	if (curPriority === prevPriority) {
		return;
	}

	// 3.更高优先级，插入，先取消(中断)之前的callback，
	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback);
	}

	let newCallbackNode = null;

	// 都是异步执行，但一个是异步微任务执行，一个异步宏任务可中断调度执行
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
		newCallbackNode = schedulerCallback(
			schedulerPriority,
			// @ts-ignore
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}

	// 保存当前执行的callback和优先级
	root.callbackNode = newCallbackNode;
	root.callbackPriority = curPriority;
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
	// performSyncWorkOnRoot 会继续调用 ensureRootIsScheduled（那这逻辑也应该放到最后啊。。。不然当前微任务都还没执行，说的啥玩意啊）
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		// 其他比SyncLane低的优先级
		ensureRootIsScheduled(root);
		return;
	}

	const existStatus = renderRoot(root, nextLane, false);

	if (existStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = nextLane;
		wipRootRenderLane = NoLane;
		// wip fiberNode树 树中的flags
		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现的同步更新结束状态');
	}
}

// 异步可中断的 Concurrent
function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	// 在执行具体工作前，保证上一次的useEffect都执行完了
	// 比如一个useEffect里发起了一个更高优先级的update，要先保证该useEffect回调先执行完（不是他妈正是因为useEffect执行完才触发update吗）

	const curCallbackNode = root.callbackNode;
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
	if (didFlushPassiveEffect) {
		// 保证执行完后，判断如果不相等，即是有更高的update，不能继续执行了。（那不应该是 ensureRootIsScheduled 来决定吗。。。）
		if (root.callbackNode !== curCallbackNode) {
			return null;
		}
	}

	const lane = getHighestPriorityLane(root.pendingLanes);

	if (lane === NoLane) {
		return null;
	}
	const shouldTimeSlice = !(lane === SyncLane || didTimeout); // 根据任务是否紧急来确定是否时间分片
	const existStatus = renderRoot(root, lane, shouldTimeSlice);

	ensureRootIsScheduled(root);
	// 中断继续执行
	if (existStatus === RootInComplete) {
		if (root.callbackNode !== curCallbackNode) {
			// 中断继续执行时和之前的断点不一致，表示有更高优先级的插入
			return null;
		}
		return performConcurrentWorkOnRoot.bind(null, root); // 否则继续从断点调度之前的、或之前插入的同优先级
	}

	if (existStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = lane;
		wipRootRenderLane = NoLane;
		// wip fiberNode树 树中的flags
		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现的同步更新结束状态');
	}
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
		// 否则重新创建 workInprogress fiber，重新构建（我真不知道react是怎么快的）
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

// 执行副作用

function flushPassiveEffects(pendingPassiveEffects: pendingPassiveEffects) {
	// 首先触发所有unmount 时的 destroy effect，且对于某个fiber,如果触发了unmount destroy，本次更新不会再触发update create

	let didFlushPassiveEffect = false;
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];

	// 触发所有上次更新的destroy（更新也会触发destroy？？？）
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});

	// 触发所有这次更新的create
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];
	flushSyncCallbacks();

	return didFlushPassiveEffect;
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
