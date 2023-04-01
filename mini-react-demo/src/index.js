import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

const jsx = <div><span>mini react</span></div>

const root = document.getElementById('root');
ReactDOM.createRoot(root).render(jsx);

console.log(React);
console.log(ReactDOM);
console.log(jsx);