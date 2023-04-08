import { Container } from 'hostConfig';
import {
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority,
	unstable_runWithPriority
} from 'scheduler';
import { Props } from 'shared/ReactTypes';

export const elementPropsKey = '__props';
const validEventTypeList = ['click'];

type EventCallback = (e: Event) => void;

interface SyntheticEvent extends Event {
	__stopPropagation: boolean;
}

interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}

export interface DOMElement extends Element {
	[elementPropsKey]?: Props;
}

// 将事件回调保存在DOM中(而不是直接添加到DOM事件中)
export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}

export function initEvent(container: Container, evenType: string) {
	if (!validEventTypeList.includes(evenType)) {
		console.warn('当前不支持', evenType, '事件');
		return;
	}

	if (__DEV__) {
		console.log('初始化事件: ', evenType);
	}

	// 事件监听都挂载到Container中的，而事件回调函数都是存在 DOM 的Props上
	// Container中调用dispatchEvent执行具体的事件回调函数
	container.addEventListener(evenType, (e) => {
		dispatchEvent(container, evenType, e);
	});
}

function dispatchEvent(container: Container, evenType: string, e: Event) {
	const targetElement = e.target;
	if (targetElement === null) {
		console.warn('事件不存在target', e);
	}

	// 1.收集沿途的事件。如触发了Click事件，则收集从e.target到Container的所有click事件
	const { bubble, capture } = collectPath(
		targetElement as DOMElement,
		container,
		evenType
	);
	// 2.构造合成事件
	const se = createSyntheticEvent(e);
	// 3.模拟事件捕获和冒泡，遍历执行capture和bubble事件数组
	triggerEventFlow(capture, se);

	if (!se.__stopPropagation) {
		triggerEventFlow(bubble, se);
	}
}

// 源码合成事件会对应多个事件，这里是简单的合成
function createSyntheticEvent(e: Event) {
	const syntheticEvent = e as SyntheticEvent;
	syntheticEvent.__stopPropagation = false;
	const originStopPropagation = e.stopPropagation;

	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true;
		if (originStopPropagation) {
			originStopPropagation();
		}
	};

	return syntheticEvent;
}

function collectPath(
	targetElement: DOMElement,
	container: Container,
	evenType: string
) {
	const paths: Paths = {
		capture: [],
		bubble: []
	};

	while (targetElement && targetElement !== container) {
		// 收集
		const elementProps = targetElement[elementPropsKey];

		if (elementProps) {
			const callbackNameList = getEventCallbackNameFromEventType(evenType);

			if (callbackNameList) {
				callbackNameList.forEach((name, i) => {
					const eventCallback = elementProps[name];

					if (eventCallback) {
						if (i === 0) {
							// capture
							paths.capture.unshift(eventCallback);
						} else {
							paths.bubble.push(eventCallback);
						}
					}
				});
			}
		}

		targetElement = targetElement.parentNode as DOMElement;
	}

	return paths;
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
	for (let i = 0; i < paths.length; i++) {
		const callback = paths[i];

		// 添加优先级处理
		unstable_runWithPriority(eventTypeToSchedulerPriority(se.type), () => {
			callback.call(null, se);
		});

		if (se.__stopPropagation) {
			// 阻止捕获或冒泡阶段
			break;
		}
	}
}

// 获取原生事件和合成事件的映射
function getEventCallbackNameFromEventType(evenType: string) {
	return {
		click: ['onClickCapture', 'onClick']
	}[evenType];
}

function eventTypeToSchedulerPriority(evenType: string) {
	switch (evenType) {
		case 'click':
		case 'keydown':
		case 'keyup':
			return unstable_ImmediatePriority;
		case 'scroll':
			return unstable_UserBlockingPriority;
		default:
			return unstable_NormalPriority;
	}
}
