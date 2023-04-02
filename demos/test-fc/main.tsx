import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(100);
	window.setNum = setNum;
	return num === 3 ? <Child /> : <span>{num}</span>;
}

function Child() {
	return <div>mini react</div>;
}
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
