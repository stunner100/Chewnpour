import React, { useCallback, useEffect, useRef } from 'react';

const COLORS = [
    '#0D9488', '#10b981', '#f59e0b', '#ef4444',
    '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6',
];

const randomRange = (min, max) => Math.random() * (max - min) + min;

const createParticle = (x, y) => ({
    id: Math.random().toString(36).slice(2),
    x,
    y,
    vx: randomRange(-8, 8),
    vy: randomRange(-14, -4),
    gravity: randomRange(0.2, 0.5),
    drag: randomRange(0.96, 0.99),
    size: randomRange(4, 10),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: randomRange(0, 360),
    rotationSpeed: randomRange(-10, 10),
    life: 1,
    decay: randomRange(0.008, 0.02),
    shape: Math.random() > 0.5 ? 'circle' : 'rect',
});

export const Confetti = ({
    active = false,
    originX = 0.5,
    originY = 0.3,
    particleCount = 80,
    onDone,
}) => {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const rafRef = useRef(null);
    const activeRef = useRef(false);

    const burst = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = rect.left + rect.width * originX;
        const y = rect.top + rect.height * originY;

        for (let i = 0; i < particleCount; i++) {
            particlesRef.current.push(createParticle(x, y));
        }
        activeRef.current = true;
    }, [originX, originY, particleCount]);

    useEffect(() => {
        if (!active) return undefined;
        burst();
        return undefined;
    }, [active, burst]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        handleResize();
        window.addEventListener('resize', handleResize);

        const ctx = canvas.getContext('2d');

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const particles = particlesRef.current;

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.vx *= p.drag;
                p.vy *= p.drag;
                p.vy += p.gravity;
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotationSpeed;
                p.life -= p.decay;

                if (p.life <= 0) {
                    particles.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillStyle = p.color;

                if (p.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                }

                ctx.restore();
            }

            if (particles.length === 0 && activeRef.current) {
                activeRef.current = false;
                if (onDone) onDone();
            }

            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [onDone]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[100]"
            style={{ width: '100vw', height: '100vh' }}
        />
    );
};

export default Confetti;
