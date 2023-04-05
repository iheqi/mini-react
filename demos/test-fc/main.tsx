import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(100);
	window.setNum = setNum;

	const arr =
		num % 2 === 0
			? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
			: [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];

	return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>;

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
