import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { FinanceProvider } from './modules/finances/FinanceContext';
import { WaterProvider } from './context/WaterContext';
import App from './App';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      registration.update();
    }).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <FinanceProvider>
          <WaterProvider>
            <App />
          </WaterProvider>
        </FinanceProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
