import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

function App() {
	const [count, setState] = useState(0);
	function onClick() {
		setTimeout(() => {
			setState(count + 1);
			setState(count + 1);
			setState(count + 1);
		});
	}

	function setStateUseFunction() {
		setTimeout(() => {
			setState((count) => count + 1);
			setState((count) => count + 1);
			setState((count) => count + 1);
		});
	}

	return (
		<div>
			<button type="button" onClick={onClick}>
				setTimeout setState
			</button>
			<button type="button" onClick={setStateUseFunction}>
				{' '}
				setState use function
			</button>
			<p>{count}</p>
		</div>
	);
}

const root = ReactDOM.createRoot(document.querySelector('#root')).render(
	<App />
);
