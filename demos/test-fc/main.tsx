import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num] = useState(100);
	return <span>{num}</span>;
}

const jsx = (
	<div>
		<App />
	</div>
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
