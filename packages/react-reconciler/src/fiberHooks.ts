import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher } from 'react/src/currentDispatcher';
import { Dispatch } from 'react/src/currentDispatcher';
import {
	UpdateQueue,
	createUpdateQueue,
	enqueueUpdate,
	createUpdate,
	processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';

const { currentDispatcher } = internals;

// Hook数据结构定义
interface Hook {
	// 这里要注意 fiberNode 上也有一个 memorizedState 字段是保存fiber相关状态的（Hook链表）
	// 而这个是保存hook数据的(state、或effect)
	memorizedState: any;
	updateQueue: unknown; // setState更新时使用
	next: Hook | null; // 链表指针
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

// 例如:
// useEffect(() => {
// 	console.log('num change create', num);
// 	return () => {
// 		console.log('num change destroy', num);
// 	}
// }, [num]);

export interface Effect {
	tag: Flags; // hookEffectTag
	create: EffectCallback | void; // 为整个回调函数
	destroy: EffectCallback | void; // create return的函数
	deps: EffectDeps; // 依赖数组
	// mountWorkInProgressHook已经会链接hook了，但这里是将effect的hook里的effect单独也链接成effect链表，方便遍历effect
	next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

// hook自身数据保存在当前 workInprogress fiberNode
let currentlyRenderingFiber: FiberNode | null = null;

let workInProgressHook: Hook | null = null; // workInprogress 树中当前的Hook数据
let currentHook: Hook | null = null; // current 树中当前的Hook数据

let renderLane: Lane = NoLane;

// 在 updateFunctionComponent 中被调用，返回 children 的同时处理 Hooks
export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值操作
	currentlyRenderingFiber = wip;
	// 重置hook链表
	wip.memoizedState = null;
	// 重置effect链表
	wip.updateQueue = null;
	renderLane = lane;
	// 根据 wip.alternate 判断在何种状态
	// 操作数据共享层，确定Hooks集合
	const current = wip.alternate;

	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 重置操作
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = NoLane;
	return children;
}

//**** Mount 时 Hooks集合  ****/
//**** Mount 时 Hooks集合  ****/
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect
};

function mountState<State>(
	initialState: () => State | State
): [State, Dispatch<State>] {
	// 找到当前useState对应的Hook数据, mount时则是创建hook数据
	const hook = mountWorkInProgressHook();

	let memoizedState;

	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}

	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	hook.memorizedState = memoizedState;

	// dispatch可以脱离函数组件执行，因为绑定了前两个参数（柯里化）
	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	queue.dispatch = dispatch; // 保存 dispatch
	return [memoizedState, dispatch];
}

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	// 找到当前useState对应的Hook数据, mount时则是创建hook数据
	const hook = mountWorkInProgressHook();

	const nextDeps = deps === undefined ? null : deps;

	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

	hook.memorizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined, // mount时没有destroy
		nextDeps
	);
}

// mountWorkInProgressHook已经会链接hook了，但这里是将effect的hook单独也链接成effect链表，方便遍历effect
function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	};

	// hook链表存储在fiber.memorizedState，effect链表存储在fiber.updateQueue.lastEffect
	// 怎么感觉扩展得很混乱
	const fiber = currentlyRenderingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;

	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue();
		fiber.updateQueue = updateQueue;

		effect.next = effect;
		updateQueue.lastEffect = effect; // 保存effect链表到fiber.updateQueue.lastEffect
	} else {
		// 插入effect
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}
	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}

// dispatch, 也是去接入更新机制，然后 scheduleUpdateOnFiber 触发更新
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLanes();
	const update = createUpdate(action, lane);
	enqueueUpdate(updateQueue, update); // 插入action
	scheduleUpdateOnFiber(fiber, lane); // 开始render和commit
}

// 创建hook，并将 hook 链表保存在 fiber 中
function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		// mount时，之前没有hook数据，创建
		memorizedState: null,
		updateQueue: null,
		next: null
	};

	// 为 null 时，表示mount时处理的第一个hook
	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件中使用hook');
		} else {
			workInProgressHook = hook;
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// 连接hook，形成单向链表
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}
	return workInProgressHook;
}

//**** Update 时 Hooks集合 ****/
//**** Update 时 Hooks集合 ****/
const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect
};

// update 时的 useState
function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前useState对应的Hook数据, mount时则是创建hook数据
	const hook = updateWorkInProgressHook();
	// 计算新state的逻辑
	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;
	queue.shared.pending = null;

	if (pending !== null) {
		// pending 不为空，表示进行了setState（dispatchSetState中向pending插入了action Update）
		// processUpdateQueue取出action进行计算新的state
		const { memoizedState } = processUpdateQueue(
			hook.memorizedState,
			pending,
			renderLane
		);
		hook.memorizedState = memoizedState;
	}

	return [hook.memorizedState, queue.dispatch as Dispatch<State>];
}

// update 时的 useEffect
function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	// 找到当前useState对应的Hook数据, mount时则是创建hook数据
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	let destroy: EffectCallback | void;

	if (currentHook !== null) {
		const prevEffect = currentHook.memorizedState as Effect;
		destroy = prevEffect.destroy;

		if (nextDeps !== null) {
			// 浅比较依赖
			const prevDeps = prevEffect.deps;
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				// 如果依赖数组相等，effect还是会push（要保证链表顺序），但没有 HookHasEffect标志，后续不会执行
				hook.memorizedState = pushEffect(Passive, create, destroy, nextDeps);
				return;
			}
		}
		// 浅比较 不相等，有 HookHasEffect
		(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
		hook.memorizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destroy,
			nextDeps
		);
	}
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	// 就是没有传依赖数组，每次都会触发
	if (prevDeps === null || nextDeps === null) {
		return false;
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue;
		}
		return false;
	}
	return true;
}

// hook 数据保存在 fiber 中, 从 fiber 获取 Hook 数据

function updateWorkInProgressHook(): Hook {
	let nextCurrentHook: Hook | null; // 他妈的搞两个变量干毛啊

	if (currentHook === null) {
		// update时当前处理的第一个useState调用
		const current = currentlyRenderingFiber?.alternate;

		if (current !== null) {
			nextCurrentHook = current?.memoizedState;
		} else {
			// 对于update时，current不应该是null（这里处理个毛啊？）
			nextCurrentHook = null;
		}
	} else {
		nextCurrentHook = currentHook.next;
	}

	// 如果业务代码第4次调用useState，对比之前(current)的hook是多了一个，报错
	if (nextCurrentHook === null) {
		// mount  u1 u2 u3
		// update u1 u2 u3 u4

		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的hook比上次执行的多`
		);
	}

	currentHook = nextCurrentHook as Hook;

	const newHook: Hook = {
		memorizedState: currentHook.memorizedState,
		updateQueue: currentHook.updateQueue,
		next: null
	};

	// 为 null 时，表示mount时处理的第一个hook
	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件中使用hook');
		} else {
			workInProgressHook = newHook;
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// 连接hook，形成单向链表
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}

	return workInProgressHook;
}
