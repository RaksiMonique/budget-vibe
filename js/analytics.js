// Vercel Web Analytics initialization
// Import and initialize Vercel Analytics
import { inject } from '../node_modules/@vercel/analytics/dist/index.mjs';

// Initialize analytics with auto mode detection
inject({ 
  mode: 'auto',
  debug: false
});
