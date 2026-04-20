import React from 'react';

// Single-source brand mark: logonew.jpeg, rendered with a rounded crop so it
// sits cleanly on both light and dark backgrounds at any size. The `theme`
// and `kind` props are kept for API compatibility with existing call sites.
const BrandLogo = ({
    alt = 'ChewnPour',
    className = 'h-12 w-auto',
}) => (
    <img
        src="/logonew.jpeg"
        alt={alt}
        className={`${className} object-contain rounded-full`}
        decoding="async"
    />
);

export default BrandLogo;
