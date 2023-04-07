import './style.css';
import {
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_LowPriority as LowPriority,
	unstable_IdlePriority as IdlePriority
} from 'scheduler';

const button = document.querySelector('button');
const root = document.querySelector('#root');

type Priority =
	| typeof IdlePriority
	| typeof LowPriority
	| typeof NormalPriority
	| typeof UserBlockingPriority
	| typeof ImmediatePriority;

interface Work {
	count: number;
}

const workList: Work[] = [];

function schedule() {
	const curWork = workList.pop();
	if (curWork) {
		perform(curWork);
	}
}

function perform(work: Work) {
	while (work.count) {
		work.count--;
		insertSpan('0');
	}
}

function insertSpan(content) {
	const span = document.createElement('span');
	span.innerText = content;
	root?.appendChild(span);
}

button &&
	(button.onclick = () => {
		workList.unshift({
			count: 100
		});
		schedule();
	});
