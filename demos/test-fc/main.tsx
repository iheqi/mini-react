import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(100);
	window.setNum = setNum;
	// Test: Fragment
	const arr = [<li>3</li>, <li>4</li>, <li>5</li>];

	return (
		<div
			onClickCapture={() => {
				setNum((num) => num + 1);
				setNum((num) => num + 1);
				setNum((num) => num + 1);
			}}
		>
			<div>{num}</div>
			<div>{num}</div>
			<>
				<div>1</div>
				<div>2</div>
			</>
			{arr}
		</div>
	);

	// Test: 多节点
	// const arr =
	// 	num % 2 === 0
	// 		? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
	// 		: [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];

	// return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>;

	// Test: setState
	// return num === 3 ? (
	// 	<Child />
	// ) : (
	// 	<span
	// 		onClick={() => {
	// 			console.log('fuck');
	// 			setNum(num + 1);
	// 		}}
	// 	>
	// 		{num}
	// 	</span>
	// );
}

function Child() {
	return <div>mini react</div>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
