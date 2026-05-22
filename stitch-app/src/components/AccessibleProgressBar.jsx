import React from 'react';

const AccessibleProgressBar = ({
    value,
    max = 100,
    label,
    valueText,
    trackClassName,
    barClassName,
    barStyle,
}) => {
    const safeMax = max > 0 ? max : 100;
    const clampedValue = Math.min(Math.max(Number(value) || 0, 0), safeMax);
    const percent = (clampedValue / safeMax) * 100;

    return (
        <div
            className={trackClassName}
            role="progressbar"
            aria-valuenow={Math.round(clampedValue)}
            aria-valuemin={0}
            aria-valuemax={safeMax}
            aria-valuetext={valueText}
            aria-label={label}
        >
            <div
                className={barClassName}
                style={{ width: `${percent}%`, ...barStyle }}
            />
        </div>
    );
};

export default AccessibleProgressBar;
