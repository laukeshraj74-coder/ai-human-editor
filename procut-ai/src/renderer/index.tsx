import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Declare the electron API on window
declare global {
  interface Window {
    electron: {
      selectFile: () => Promise<string | undefined>;
      saveFile: (defaultPath: string) => Promise<string | undefined>;
      getAppPath: () => Promise<string>;
      platform: string;
    };
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
