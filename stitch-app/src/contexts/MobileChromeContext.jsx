import React, { createContext, useContext, useMemo, useState } from 'react';

const MobileChromeContext = createContext({
    immersive: false,
    setImmersiveMobile: () => {},
});

export const MobileChromeProvider = ({ children }) => {
    const [immersive, setImmersiveMobile] = useState(false);
    const value = useMemo(
        () => ({ immersive, setImmersiveMobile }),
        [immersive],
    );
    return (
        <MobileChromeContext.Provider value={value}>
            {children}
        </MobileChromeContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useMobileChrome = () => useContext(MobileChromeContext);
