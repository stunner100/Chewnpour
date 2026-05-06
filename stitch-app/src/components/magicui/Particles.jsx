import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

const hexToRgb = (hex) => {
    const cleaned = hex.replace('#', '');
    const value = cleaned.length === 3
        ? cleaned.split('').map((c) => c + c).join('')
        : cleaned;
    const num = parseInt(value, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

const remapValue = (value, start1, end1, start2, end2) => {
    const remapped = ((value - start1) * (end2 - start2)) / (end1 - start1) + start2;
    return remapped > 0 ? remapped : 0;
};

export const Particles = ({
    className,
    quantity = 80,
    staticity = 50,
    ease = 50,
    size = 0.6,
    color = '#914bf1',
    vx = 0,
    vy = 0,
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return undefined;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rgb = hexToRgb(color);
        const particles = [];
        const mouse = { x: 0, y: 0 };
        const canvasSize = { w: 0, h: 0 };

        const resize = () => {
            canvasSize.w = container.offsetWidth;
            canvasSize.h = container.offsetHeight;
            canvas.width = canvasSize.w * dpr;
            canvas.height = canvasSize.h * dpr;
            canvas.style.width = `${canvasSize.w}px`;
            canvas.style.height = `${canvasSize.h}px`;
            ctx.scale(dpr, dpr);
        };

        const createParticle = () => ({
            x: Math.floor(Math.random() * canvasSize.w),
            y: Math.floor(Math.random() * canvasSize.h),
            translateX: 0,
            translateY: 0,
            size: Math.floor(Math.random() * 2) + size,
            alpha: 0,
            targetAlpha: parseFloat((Math.random() * 0.6 + 0.1).toFixed(1)),
            dx: (Math.random() - 0.5) * 0.1,
            dy: (Math.random() - 0.5) * 0.1,
            magnetism: 0.1 + Math.random() * 4,
        });

        const drawCircle = (p) => {
            ctx.translate(p.translateX, p.translateY);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(${rgb.join(', ')}, ${p.alpha})`;
            ctx.fill();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const clear = () => ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

        const init = () => {
            particles.length = 0;
            for (let i = 0; i < quantity; i++) {
                particles.push(createParticle());
            }
        };

        const tick = () => {
            clear();
            particles.forEach((p, i) => {
                const edge = [
                    p.x + p.translateX - p.size,
                    canvasSize.w - p.x - p.translateX - p.size,
                    p.y + p.translateY - p.size,
                    canvasSize.h - p.y - p.translateY - p.size,
                ];
                const closestEdge = edge.reduce((a, b) => Math.min(a, b));
                const remapClosestEdge = parseFloat(remapValue(closestEdge, 0, 20, 0, 1).toFixed(2));
                if (remapClosestEdge > 1) {
                    p.alpha += 0.02;
                    if (p.alpha > p.targetAlpha) p.alpha = p.targetAlpha;
                } else {
                    p.alpha = p.targetAlpha * remapClosestEdge;
                }
                p.x += p.dx + vx;
                p.y += p.dy + vy;
                p.translateX += (mouse.x / (staticity / p.magnetism) - p.translateX) / ease;
                p.translateY += (mouse.y / (staticity / p.magnetism) - p.translateY) / ease;
                drawCircle(p);
                if (
                    p.x < -p.size ||
                    p.x > canvasSize.w + p.size ||
                    p.y < -p.size ||
                    p.y > canvasSize.h + p.size
                ) {
                    particles.splice(i, 1);
                    particles.push(createParticle());
                }
            });
            animationRef.current = requestAnimationFrame(tick);
        };

        resize();
        init();
        tick();

        const handleResize = () => {
            resize();
            init();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [quantity, staticity, ease, size, color, vx, vy]);

    return (
        <div ref={containerRef} className={cn('pointer-events-none', className)} aria-hidden="true">
            <canvas ref={canvasRef} className="size-full" />
        </div>
    );
};

export default Particles;
