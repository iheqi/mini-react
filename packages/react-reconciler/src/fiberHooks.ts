import internals from 'shared/internal';
import { FiberNode } from './fiber';
import { Dispatcher } from 'react/src/currentDispatcher';
import { Dispatch } from 'react/src/currentDispatcher';
import {
	UpdateQueue,
	createUpdateQueue,
	enqueueUpdate,
	createUpdate
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';

const { currentDispatcher } = internals;

// Hook数据结构定义
interface Hook {
	// 这里要注意 fiberNode 上也有一个 memorizedState 字段是保存fiber相关状态的
	// 而这个是保存hook数据的
	memorizedState: any;
	updateQueue: unknown; // setState更新时使用
	next: Hook | null; // 链表指针
}

// hook自身数据保存在当前 fiberNode
let currentlyRenderingFiber: FiberNode | null = null;

let workInProgressHook: Hook | null = null;

// 在 updateFunctionComponent 中被调用，返回 children 的同时处理 Hooks
export function renderWithHooks(wip: FiberNode) {
	// 赋值操作
	currentlyRenderingFiber = wip;
	wip.memoizedState = null; // 初始化，收集hook

	// 根据 wip.alternate 判断在何种状态
	// 操作数据共享层，确定Hooks集合
	const current = wip.alternate;

	if (current !== null) {
		// TODO
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 重置操作
	currentlyRenderingFiber = null;
	return children;
}

// Mount 时 Hooks集合
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
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
	queue.dispatch = dispatch;
	return [memoizedState, dispatch];
}

// dispatch, 也是去接入更新机制，然后 scheduleUpdateOnFiber 触发更新
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const update = createUpdate(action);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber);
}

// 创建hook，并将 hook 数据保存在 fiber 中
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
			throw new Error('请在函数中使用hook');
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
