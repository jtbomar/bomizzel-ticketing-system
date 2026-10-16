import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { reloadForNewVersion } from './utils/staleBuild';
import { companyInAddress, takeHandoff } from './utils/companyAddress';

// A page file from the previous deploy is gone: load the new version
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

// portal.bomizzel.com/<company>/...: the app runs under the company's name
const company = companyInAddress();

// A sign-in handed over from bomizzel.com (or Google, Microsoft, Facebook)
// is taken first, so the app starts signed in.
void takeHandoff().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter basename={company ? `/${company}` : undefined}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
});
