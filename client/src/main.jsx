import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

// Variable fonts are bundled locally (no external font CDN → no layout shift,
// no third-party request, better Lighthouse).
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
