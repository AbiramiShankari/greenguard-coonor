// GreenGuard — App Entry Point
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';
import App from './App.jsx';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

defineCustomElements(window);
