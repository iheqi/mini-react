import './style.css';
import {
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_LowPriority as LowPriority,
	unstable_IdlePriority as IdlePriority,
	unstable_scheduleCallback as scheduleCallback,
	unstable_shouldYield as shouldYield,
	CallbackNode,
	unstable_getFirstCallbackNode as getFirstCallbackNode,
	unstable_cancelCallback as cancelCallback
} from 'scheduler';

const root = document.querySelector('#root');

type Priority =
	| typeof IdlePriority
	| typeof LowPriority
	| typeof NormalPriority
	| typeof UserBlockingPriority
	| typeof ImmediatePriority;

interface Work {
	count: number;
	priority: Priority;
}

const workList: Work[] = [];
let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(
	(priority) => {
		const btn = document.createElement('button');
		root?.appendChild(btn);
		btn.innerText = [
			'',
			'ImmediatePriority',
			'UserBlockingPriority',
			'NormalPriority',
			'LowPriority'
		][priority];
		btn.onclick = () => {
			workList.unshift({
				count: 100,
				priority: priority as Priority
			});
			schedule();
		};
	}
);

// 交互: 插入work -> 调用 schedule（策略逻辑）-> perform -> 继续调度

function schedule() {
	const cbNode = getFirstCallbackNode();
	const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];
	// 策略逻辑

	// 没有work
	if (!curWork) {
		curCallback = null;
		cbNode && cancelCallback(cbNode);
		return;
	}

	// 工作过程中产生相同优先级的work，如果优先级相同，则不需要开启新的调度。
	const { priority: curPriority } = curWork;

	if (curPriority === prevPriority) {
		return;
	}

	// 更高优先级的curWork：取消之前的work
	cbNode && cancelCallback(cbNode);
	curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}

/**
 * 1. work.priority
 * 2. 饥饿问题
 * 3. 时间切片
 */
function perform(work: Work, didTimeout?: boolean) {
	const needSync = work.priority === ImmediatePriority || didTimeout;

	// 任务过期了或者有空闲时间才执行
	while ((needSync || !shouldYield()) && work.count) {
		work.count--;
		insertSpan(work.priority + '');
	}

	// 如果while被中断，保存优先级
	prevPriority = work.priority;
	if (!work.count) {
		const workIndex = workList.indexOf(work);
		workList.splice(workIndex, 1);
		prevPriority = IdlePriority;
	}

	const prevCallback = curCallback;
	schedule();
	const newCallback = curCallback;

	if (newCallback && prevCallback === newCallback) {
		return perform.bind(null, work);
	}
}

function insertSpan(content) {
	const span = document.createElement('span');
	span.innerText = content;
	span.className = `pri-${content}`;
	doSomeBuzyWork();
	root?.appendChild(span);
}

function doSomeBuzyWork() {
	const start = Date.now();
	while (Date.now() < start + 100) {}
}
