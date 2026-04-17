import React from 'react';

const WORDMARK_SRC = {
    light: '/brand/logo-light.png',
    dark: '/brand/logo-dark.png',
};

const BrandLogo = ({
    alt = 'ChewnPour',
    className = 'h-12 w-auto',
    kind = 'wordmark',
    theme = 'adaptive',
}) => {
    if (kind === 'mark') {
        return <img src="/brand/mark.png" alt={alt} className={className} decoding="async" />;
    }

    if (theme === 'light' || theme === 'dark') {
        return (
            <img
                src={WORDMARK_SRC[theme]}
                alt={alt}
                className={className}
                decoding="async"
            />
        );
    }

    return (
        <>
            <img
                src={WORDMARK_SRC.light}
                alt={alt}
                className={`${className} dark:hidden`}
                decoding="async"
            />
            <img
                src={WORDMARK_SRC.dark}
                alt={alt}
                className={`${className} hidden dark:block`}
                decoding="async"
            />
        </>
    );
};

export default BrandLogo;
