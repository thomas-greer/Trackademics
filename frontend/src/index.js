import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import "./index.css";

import { Provider } from 'react-redux';
import { store } from './store';
import { ThemeProvider } from './components/ThemeProvider';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <Provider store={store}>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </Provider>
);