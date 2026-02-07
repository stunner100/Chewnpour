import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from "convex/react";
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { convexUrl, hasConvexUrl } from './lib/convex-config.js'

const convex = hasConvexUrl ? new ConvexReactClient(convexUrl) : null;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {hasConvexUrl && convex ? (
      <ConvexProvider client={convex}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ConvexProvider>
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </StrictMode>,
)
