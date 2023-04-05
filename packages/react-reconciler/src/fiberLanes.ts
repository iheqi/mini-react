export type Lane = number;
export type Lanes = number;

export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane) {
	return laneA | laneB;
}

// 更新是通过更新机制去执行，所以lane可以在创建 update 时产生，作为update的lane字段。
// 为后续不同事件产生不同优先级更新做准备。
export function requestUpdateLanes() {
	return SyncLane;
}
