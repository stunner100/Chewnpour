import React from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import App from '../App.jsx';
import { AuthProvider } from '../contexts/AuthContext.jsx';
import { authClient } from '../lib/auth-client.js';
import { convexUrl, hasConvexUrl } from '../lib/convex-config.js';

const convex = hasConvexUrl ? new ConvexReactClient(convexUrl) : null;

const AppProviders = () => {
    if (hasConvexUrl && convex) {
        return (
            <ConvexBetterAuthProvider client={convex} authClient={authClient}>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </ConvexBetterAuthProvider>
        );
    }

    return (
        <AuthProvider>
            <App />
        </AuthProvider>
    );
};

export default AppProviders;
