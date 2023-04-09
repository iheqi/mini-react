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
import { Lane, isSubsetOfLanes } from './fiberLanes';

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

// 消费Update，update现在是一条链表，需要遍历

// 如何同时兼顾「update的连续性」与「update的优先级」？

// 1. 新增baseState、baseQueue字段：baseState是本次更新参与计算的初始state, memoizedState是上次更新计算的最终state
// 2. 如果本次更新没有update被跳过，则下次更新开始时 baseState === memoizedState (已有逻辑)
// 3. 如果本次更新有update被跳过，则本次更新计算出的	memoizedState为「考虑优先级」情况下计算的结果，
// baseState为「最后一个没被跳过的update计算后的结果」，下次更新开始时baseState !== memoizedState
// 4. 本次更新 被跳过的update及其后面的所有update都会被保存在baseQueue中参与下次state计算
// 5. 本次更新「参与计算但保存在baseQueue中的update」，优先级会降低到NoLane（这些update在下一次render一定会参与计算）

export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null, // 待消费的 update
	renderLane: Lane
): {
	memoizedState: State;
	baseState: State;
	baseQueue: Update<State> | null;
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState,
		baseState,
		baseQueue: null
	};

	if (pendingUpdate !== null) {
		const first = pendingUpdate.next;
		let pending = pendingUpdate.next as Update<any>;

		// 1. 新增baseState、baseQueue字段：baseState是本次更新参与计算的初始state, memoizedState是上次更新计算的最终state

		let newBaseState = baseState;
		let newBaseQueueFirst: Update<State> | null = null;
		let newBaseQueueLast: Update<State> | null = null;

		let newState = baseState;

		// pending = c -> a -> b -> c 的执行流程: a -> b -> c
		do {
			if (!isSubsetOfLanes(renderLane, pending.lane)) {
				// 优先级不够，被跳过。放到下一次schedule
				const clone = createUpdate(pending.action, pending.lane);

				// 3. 如果本次更新有update被跳过，则本次更新计算出的	memoizedState为「考虑优先级」情况下计算的结果，
				// baseState为「最后一个没被跳过的update计算后的结果」，下次更新开始时baseState !== memoizedState
				if (newBaseQueueFirst === null) {
					// first = u0 last = u0
					newBaseQueueFirst = clone;
					newBaseQueueLast = clone;
					newBaseState = newState;
				} else {
					// 4. 本次更新 被跳过的update及其后面的所有update都会被保存在baseQueue中参与下次state计算
					// 5. 本次更新「参与计算但保存在baseQueue中的update」，优先级会降低到NoLane（这些update在下一次render一定会参与计算）

					// first = u0 -> u1，last = u1
					// first = u0 -> u1 -> u2，last = u2
					(newBaseQueueLast as Update<State>).next = clone;
					newBaseQueueLast = clone;
				}
			} else {
				// 优先级足够的lane才执行
				// 4+5: 本次更新 被跳过的update及其后面的所有update都会被保存在baseQueue中参与下次state计算，并且优先级是Lane

				if (newBaseQueueLast !== null) {
					const clone = createUpdate(pending.action, pending.lane);
					newBaseQueueLast.next = clone;
					newBaseQueueLast = clone;
				}

				const action = pending.action;

				if (action instanceof Function) {
					// newState 1 update (x) => 4x -> memoizedState 4
					newState = action(newState);
				} else {
					// newState 1 update 2 -> memoizedState 2
					newState = action;
				}
			}
			pending = pending.next as Update<any>;
		} while (pending !== first);

		if (newBaseQueueLast === null) {
			// 本次计算没有update被跳过
			newBaseState = newState;
		} else {
			newBaseQueueLast.next = newBaseQueueFirst;
		}

		result.memoizedState = newState;
		result.baseState = newBaseState;
		result.baseQueue = newBaseQueueLast;
	}

	return result; // 返回新state结果对象
};
