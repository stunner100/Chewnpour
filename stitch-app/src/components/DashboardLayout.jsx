import React from 'react';
import { useLocation } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';

/**
 * Layout wrapper for all authenticated (dashboard) pages.
 * Renders the persistent mobile bottom navigation bar on small screens.
 */
const DashboardLayout = ({ children }) => {
    const location = useLocation();
    const hideMobileBottomNav = location.pathname.startsWith('/dashboard/exam');

    return (
        <>
            {children}
            {!hideMobileBottomNav && <MobileBottomNav />}
        </>
    );
};

export default DashboardLayout;
