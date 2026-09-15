import React from 'react';
import MaintenanceScreen from '../components/MaintenanceScreen.jsx';
import PwaUpdatePrompt from '../components/PwaUpdatePrompt.jsx';
import App from '../App.jsx';
import { AuthProvider } from '../contexts/AuthContext.jsx';
import { TooltipProvider } from '../components/ui/tooltip.jsx';
import { maintenanceModeEnabled } from '../lib/maintenance-mode.js';

const withAppShell = (children) => (
    <TooltipProvider delayDuration={0}>
        {children}
    </TooltipProvider>
);

const AppProviders = () => {
    if (maintenanceModeEnabled) {
        return <MaintenanceScreen />;
    }

    return withAppShell(
        <AuthProvider>
            <App />
            <PwaUpdatePrompt />
        </AuthProvider>
    );
};

export default AppProviders;
