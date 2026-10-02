import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/rajdhani/latin-600.css';
import './tailwind.css';
import './styles.css';
import './polish.css';
import './profile.css';
import './bento.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
