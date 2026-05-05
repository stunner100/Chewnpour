import React, { useEffect, useRef } from 'react';

const CanvasCrowd = ({ className = '', height = 280 }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const particlesRef = useRef([]);
    const mouseRef = useRef({ x: -1000, y: -1000, active: false });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width = canvas.offsetWidth;
        let dpr = window.devicePixelRatio || 1;

        const resize = () => {
            width = canvas.offsetWidth;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
        };

        resize();

        const particleCount = Math.min(Math.floor(width / 12), 90);
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                baseX: Math.random() * width,
                baseY: Math.random() * height,
                size: Math.random() * 2.5 + 1.5,
                color: `rgba(${145 + Math.random() * 60}, ${75 + Math.random() * 50}, ${241}, ${0.3 + Math.random() * 0.4})`,
                vx: 0,
                vy: 0,
                speed: Math.random() * 0.5 + 0.2,
                angle: Math.random() * Math.PI * 2,
                angleSpeed: (Math.random() - 0.5) * 0.02,
                wanderRadius: Math.random() * 30 + 10,
            });
        }
        particlesRef.current = particles;

        const handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                active: true,
            };
        };

        const handleMouseLeave = () => {
            mouseRef.current.active = false;
        };

        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);

        const animate = () => {
            ctx.clearRect(0, 0, width, height);

            const mouse = mouseRef.current;

            particles.forEach((p) => {
                // Wander behavior
                p.angle += p.angleSpeed;
                const targetX = p.baseX + Math.cos(p.angle) * p.wanderRadius;
                const targetY = p.baseY + Math.sin(p.angle) * p.wanderRadius;

                // Mouse repulsion
                let repelX = 0;
                let repelY = 0;
                if (mouse.active) {
                    const dx = p.x - mouse.x;
                    const dy = p.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120 && dist > 0) {
                        const force = (120 - dist) / 120;
                        repelX = (dx / dist) * force * 3;
                        repelY = (dy / dist) * force * 3;
                    }
                }

                // Spring back to target
                p.vx += (targetX - p.x) * 0.015 + repelX * 0.1;
                p.vy += (targetY - p.y) * 0.015 + repelY * 0.1;
                p.vx *= 0.94;
                p.vy *= 0.94;

                p.x += p.vx;
                p.y += p.vy;

                // Draw particle
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            });

            // Draw connections between nearby particles
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 60) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(145, 75, 241, ${0.08 * (1 - dist / 60)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        const handleResize = () => {
            resize();
            // Re-distribute particles on resize
            particles.forEach((p) => {
                p.baseX = Math.min(p.baseX, width);
                p.x = Math.min(p.x, width);
            });
        };

        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationRef.current);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('resize', handleResize);
        };
    }, [height]);

    return (
        <canvas
            ref={canvasRef}
            className={`w-full block ${className}`}
            style={{ height: `${height}px` }}
        />
    );
};

export default CanvasCrowd;
