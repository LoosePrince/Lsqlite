import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import 'antd/dist/reset.css';
import 'antd-mobile/es/global';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);