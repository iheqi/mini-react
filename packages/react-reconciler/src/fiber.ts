// packages/react-reconciler/src/ReactFiber.new.js

import { Props, Key, Ref } from 'shared/ReactTypes';
import { WorkTag } from './workTags';

import { Flags, NoFlags } from './fiberFlags';

export class FiberNode {
	type: any;
	tag: WorkTag;
	pendingProps: Props;
	key: Key;
	stateNode: any;
	ref: Ref;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	memoizedProps: Props | null;

	alternate: FiberNode | null; // 双缓存树对应指针
	flags: Flags;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key;
		this.stateNode = null; // dom
		this.type = null;

		// 构成树状结构
		this.return = null;
		this.sibling = null;
		this.child = null;
		this.index = 0;

		this.ref = null;

		// 作为工作单元
		this.pendingProps = pendingProps; // 初始化时
		this.memoizedProps = null; // 工作完后的状态

		this.alternate = null;

		// 打标签，用在后续commit（也叫副作用）
		this.flags = NoFlags;
	}
}
