import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import 'antd/dist/reset.css';
import 'antd-mobile/es/global';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { AppProviders } from './providers/AppProviders.js';
import './styles.css';

const storedTheme = localStorage.getItem('lsqlite-theme-mode');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialDark = storedTheme === 'dark' || (storedTheme !== 'light' && prefersDark);
document.documentElement.dataset.theme = initialDark ? 'dark' : 'light';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
