import React from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import MaintenanceScreen from '../components/MaintenanceScreen.jsx';
import App from '../App.jsx';
import { AuthProvider } from '../contexts/AuthContext.jsx';
import { TooltipProvider } from '../components/ui/tooltip.jsx';
import { authClient } from '../lib/auth-client.js';
import { convexUrl, hasConvexUrl } from '../lib/convex-config.js';
import { maintenanceModeEnabled } from '../lib/maintenance-mode.js';

const convex = !maintenanceModeEnabled && hasConvexUrl ? new ConvexReactClient(convexUrl) : null;

const withAppShell = (children) => (
    <TooltipProvider delayDuration={0}>
        {children}
    </TooltipProvider>
);

const AppProviders = () => {
    if (maintenanceModeEnabled) {
        return <MaintenanceScreen />;
    }

    if (hasConvexUrl && convex) {
        return withAppShell(
            <ConvexBetterAuthProvider client={convex} authClient={authClient}>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </ConvexBetterAuthProvider>
        );
    }

    return withAppShell(
        <AuthProvider>
            <App />
        </AuthProvider>
    );
};

export default AppProviders;
