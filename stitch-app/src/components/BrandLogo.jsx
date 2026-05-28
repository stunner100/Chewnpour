import React from 'react';

const LOGO_VARIANTS = {
    default: { src: '/brand/logo.svg', ratio: 406 / 97 },
    white: { src: '/brand/logo-white.svg', ratio: 406 / 97 },
    mark: { src: '/brand/mark.png', ratio: 1 },
};

const BrandLogo = ({
    variant = 'default',
    alt = 'ChewnPour',
    className = 'h-12 w-auto',
    decorative = false,
    size,
    style,
    ...imgProps
}) => {
    const logo = LOGO_VARIANTS[variant] || LOGO_VARIANTS.default;
    const sizeStyle = size
        ? { width: Math.round(size * logo.ratio), height: size }
        : undefined;

    return (
        <img
            src={logo.src}
            alt={decorative ? '' : alt}
            aria-hidden={decorative ? true : undefined}
            className={['block object-contain', className].filter(Boolean).join(' ')}
            style={{ ...sizeStyle, ...style }}
            decoding="async"
            {...imgProps}
        />
    );
};

export default BrandLogo;
