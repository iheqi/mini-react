import {
	unstable_getCurrentPriorityLevel,
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority
} from 'scheduler';
import { FiberRootNode } from './fiber';

export type Lane = number;
export type Lanes = number;

export const NoLane = 0b0000;
export const InputContinuousLane = 0b0010; // 连续事件，如拖拽
export const DefaultLane = 0b0010;
export const IdleLane = 0b0010;

export const NoLanes = 0b0000;

// 数值越小，优先级越高
export const SyncLane = 0b0001;

export function mergeLanes(laneA: Lane, laneB: Lane) {
	return laneA | laneB;
}

// 更新是通过更新机制去执行，所以lane可以在创建 update 时产生，作为update的lane字段。
// 为后续不同事件产生不同优先级更新做准备。

export function requestUpdateLane() {
	// 从上下文环境获取Scheduler优先级
	const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
	const lane = schedulerPriorityToLane(currentSchedulerPriority);

	return lane;
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
	// 如 0b0011 返回 0b0001
	return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}

// lane 到 Scheduler Priority的映射
export function lanesToSchedulerPriority(lanes: Lanes) {
	const lane = getHighestPriorityLane(lanes);

	if (lane === SyncLane) {
		return unstable_ImmediatePriority;
	}
	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority;
	}
	if (lane === DefaultLane) {
		return unstable_NormalPriority;
	}
	return unstable_IdlePriority;
}

// Scheduler Priority 到 lane 的映射

export function schedulerPriorityToLane(schedulerPriority: number): Lane {
	if (schedulerPriority === unstable_ImmediatePriority) {
		return SyncLane;
	}
	if (schedulerPriority === unstable_UserBlockingPriority) {
		return InputContinuousLane;
	}
	if (schedulerPriority === unstable_NormalPriority) {
		return DefaultLane;
	}
	return NoLane;
}
