import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

function App() {
  return <span>function component</span>
}

const jsx = <div><App /></div>

const root = document.getElementById('root');
ReactDOM.createRoot(root).render(jsx);

console.log(React);
console.log(ReactDOM);
console.log(jsx);