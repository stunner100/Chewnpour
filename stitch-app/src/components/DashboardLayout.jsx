import React from 'react';
import MobileBottomNav from './MobileBottomNav';

/**
 * Layout wrapper for all authenticated (dashboard) pages.
 * Renders the persistent mobile bottom navigation bar on small screens.
 */
const DashboardLayout = ({ children }) => {
    return (
        <>
            {children}
            <MobileBottomNav />
        </>
    );
};

export default DashboardLayout;
