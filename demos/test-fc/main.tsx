import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	return <span>function component 123</span>;
}

const jsx = (
	<div>
		<App />
	</div>
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
