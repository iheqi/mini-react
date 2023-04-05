// 常见的触发更新的方式：
// ReactDOM.createRoot().render(或老版的ReactDOM.render)
// this.setState
// useState的dispatch方法

// 我们希望实现一套统一的更新机制，他的特点是：
// • 兼容上述触发更新的方式
// • 方便后续扩展（优先级机制….)

// 更新机制的组成部分
// 代表更新的数据结构 — Update
// 消费update的数据结构 一 UpdateQueue

import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null; // update可能有多个，用链表的形式链接
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

// 创建
export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null
	};
};

export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

// 插入队列
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;

	// 这样搞成环状链表，搞毛啊
	// pending = a -> a
	// pending = b -> a -> b
	// pending = c -> a -> b -> c
	if (pending === null) {
		update.next = update;
	} else {
		update.next = pending.next;
		pending.next = update;
	}
	updateQueue.shared.pending = update;
};

// 消费Update
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null // 待消费的 update
): {
	memoizedState: State;
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};

	if (pendingUpdate !== null) {
		const action = pendingUpdate.action;

		if (action instanceof Function) {
			// baseState 1 update (x) => 4x -> memoizedState 4
			result.memoizedState = action(baseState);
		} else {
			// baseState 1 update 2 -> memoizedState 2
			result.memoizedState = action;
		}
	}

	return result; // 返回新state结果对象
};
