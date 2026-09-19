import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

const palettesForStatus = (status) => {
    switch (status) {
        case 'idle':
            return {
                core: '#F4D7A4',
                mid: '#C99555',
                rim: '#7A5428',
                glow: 'rgba(201, 149, 85, 0.38)',
                wash: 'rgba(232, 176, 96, 0.12)',
            };
        case 'connecting':
            return {
                core: '#F8E2B8',
                mid: '#D4A45C',
                rim: '#8A6230',
                glow: 'rgba(232, 176, 96, 0.48)',
                wash: 'rgba(232, 176, 96, 0.18)',
            };
        case 'listening':
            return {
                core: '#EAF6EE',
                mid: '#8FBF9A',
                rim: '#3F6F55',
                glow: 'rgba(143, 191, 154, 0.52)',
                wash: 'rgba(143, 191, 154, 0.16)',
            };
        case 'speaking':
            return {
                core: '#FFF4D4',
                mid: '#F0B45A',
                rim: '#C47A2A',
                glow: 'rgba(240, 180, 90, 0.72)',
                wash: 'rgba(255, 210, 120, 0.3)',
            };
        case 'error':
            return {
                core: '#F6D4D0',
                mid: '#D98980',
                rim: '#8A4540',
                glow: 'rgba(217, 137, 128, 0.42)',
                wash: 'rgba(217, 137, 128, 0.14)',
            };
        default: {
            const _exhaustive = status;
            throw new Error(`Unknown live tutor status: ${_exhaustive}`);
        }
    }
};

const blobRadius = (angle, time, energy, reducedMotion) => {
    if (reducedMotion) return 1;
    const shimmer = 0.012 + Math.min(0.35, energy) * 0.02;
    return (
        1
        + Math.sin(angle * 3 + time * 0.8) * shimmer
        + Math.sin(angle * 6 + time * 1.25) * (shimmer * 0.45)
    );
};

const liveEnergy = (status, level) => {
    switch (status) {
        case 'speaking':
            return Math.min(1, Math.max(0.12, level));
        case 'listening':
            return Math.min(0.4, 0.08 + level * 0.28);
        case 'connecting':
            return 0.16;
        case 'error':
            return 0.06;
        case 'idle':
            return 0.05;
        default: {
            const _exhaustive = status;
            throw new Error(`Unknown live tutor status: ${_exhaustive}`);
        }
    }
};

const drawOrb = (ctx, { width, height, time, level, status, reducedMotion }) => {
    const palette = palettesForStatus(status);
    const cx = width / 2;
    const cy = height / 2;
    const minSide = Math.min(width, height);
    const connectingPulse = status === 'connecting'
        ? 0.04 * Math.sin(time * 2.2)
        : 0;
    const energy = reducedMotion
        ? liveEnergy(status, status === 'speaking' ? 0.4 : 0)
        : liveEnergy(status, level) + connectingPulse;
    const radius = minSide * (0.21 + Math.min(0.7, energy) * 0.04);

    ctx.clearRect(0, 0, width, height);

    const wash = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, minSide * 0.52);
    wash.addColorStop(0, palette.wash);
    wash.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius * (2.15 + energy));
    glow.addColorStop(0, palette.glow);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (2.2 + energy * 0.8), 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    const steps = 72;
    for (let index = 0; index <= steps; index += 1) {
        const angle = (index / steps) * Math.PI * 2;
        const wobble = blobRadius(angle, time, energy, reducedMotion);
        const x = cx + Math.cos(angle) * radius * wobble;
        const y = cy + Math.sin(angle) * radius * wobble;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const body = ctx.createRadialGradient(
        cx - radius * 0.28,
        cy - radius * 0.34,
        radius * 0.08,
        cx,
        cy + radius * 0.12,
        radius * 1.15,
    );
    body.addColorStop(0, palette.core);
    body.addColorStop(0.46, palette.mid);
    body.addColorStop(1, palette.rim);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(
        cx - radius * 0.22,
        cy - radius * 0.32,
        radius * (0.28 + energy * 0.08),
        radius * (0.16 + energy * 0.04),
        -0.45,
        0,
        Math.PI * 2,
    );
    ctx.fillStyle = 'rgba(255, 252, 244, 0.42)';
    ctx.fill();
};

const LiveTutorOrb = ({ status = 'idle', levelRef }) => {
    const canvasRef = useRef(null);
    const statusRef = useRef(status);
    const reduceMotion = useReducedMotion();
    const paintNowRef = useRef(() => {});

    useEffect(() => {
        statusRef.current = status;
        paintNowRef.current();
    }, [status]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;

        let frame = 0;
        let disposed = false;
        const started = performance.now();

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.max(1, Math.round(rect.width * ratio));
            canvas.height = Math.max(1, Math.round(rect.height * ratio));
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        };

        const paint = (now) => {
            if (disposed) return;
            const rect = canvas.getBoundingClientRect();
            const level = Number(levelRef?.current) || 0;
            drawOrb(ctx, {
                width: rect.width,
                height: rect.height,
                time: (now - started) / 1000,
                level,
                status: statusRef.current,
                reducedMotion: Boolean(reduceMotion),
            });
            canvas.dataset.voiceLevel = level.toFixed(2);
            if (reduceMotion) return;
            frame = requestAnimationFrame(paint);
        };

        resize();
        paintNowRef.current = () => paint(performance.now());
        paint(performance.now());
        const observer = new ResizeObserver(() => {
            resize();
            if (reduceMotion) paint(performance.now());
        });
        observer.observe(canvas);

        return () => {
            disposed = true;
            observer.disconnect();
            if (frame) cancelAnimationFrame(frame);
        };
    }, [levelRef, reduceMotion]);

    return (
        <div
            className={cn(
                'live-tutor-orb-stage relative h-[240px] w-full overflow-hidden rounded-[1.25rem]',
                status === 'speaking' && 'live-tutor-orb-stage--speaking',
                status === 'listening' && 'live-tutor-orb-stage--listening',
            )}
            aria-hidden="true"
        >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        </div>
    );
};

export default LiveTutorOrb;
