import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppShell } from './components/AppShell';
import { initSyncListener } from './sync';
import { seedSampleData } from './db';
import './index.css';

// Register sync listener (handles auto-sync on reconnect)
initSyncListener();

// Seed sample data on first run
seedSampleData();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);
