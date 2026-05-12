import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const DEFAULT_SRC = '/images/peeps/all-peeps.png';

const CanvasCrowd = ({
    src = DEFAULT_SRC,
    rows = 15,
    cols = 7,
    className = '',
    height = 280,
}) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;

        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const image = document.createElement('img');
        const stage = { width: 0, height: 0, dpr: window.devicePixelRatio || 1 };
        const allPeeps = [];
        const availablePeeps = [];
        const crowd = [];
        let initialized = false;

        const randomRange = (min, max) => min + Math.random() * (max - min);
        const randomIndex = (array) => Math.floor(randomRange(0, array.length));
        const removeFromArray = (array, index) => array.splice(index, 1)[0];
        const removeItemFromArray = (array, item) => {
            const index = array.indexOf(item);
            return index >= 0 ? removeFromArray(array, index) : null;
        };
        const removeRandomFromArray = (array) => removeFromArray(array, randomIndex(array));

        const createPeep = (rect) => {
            const peep = {
                rect,
                width: rect[2],
                height: rect[3],
                x: 0,
                y: 0,
                anchorY: 0,
                scaleX: 1,
                walk: null,
                render(renderCtx) {
                    renderCtx.save();
                    renderCtx.translate(this.x, this.y);
                    renderCtx.scale(this.scaleX, 1);
                    renderCtx.drawImage(
                        image,
                        this.rect[0],
                        this.rect[1],
                        this.rect[2],
                        this.rect[3],
                        0,
                        0,
                        this.width,
                        this.height,
                    );
                    renderCtx.restore();
                },
            };
            return peep;
        };

        const createPeeps = () => {
            const rectWidth = image.naturalWidth / rows;
            const rectHeight = image.naturalHeight / cols;
            const total = rows * cols;

            allPeeps.length = 0;
            for (let i = 0; i < total; i += 1) {
                allPeeps.push(createPeep([
                    (i % rows) * rectWidth,
                    Math.floor(i / rows) * rectHeight,
                    rectWidth,
                    rectHeight,
                ]));
            }
        };

        const resetPeep = (peep) => {
            const direction = Math.random() > 0.5 ? 1 : -1;
            const offsetY = 100 - 250 * gsap.parseEase('power2.in')(Math.random());
            const startY = stage.height - peep.height + offsetY;
            const startX = direction === 1 ? -peep.width : stage.width + peep.width;
            const endX = direction === 1 ? stage.width : 0;

            peep.scaleX = direction;
            peep.x = startX;
            peep.y = startY;
            peep.anchorY = startY;

            return { endX, startY };
        };

        const removePeepFromCrowd = (peep) => {
            removeItemFromArray(crowd, peep);
            availablePeeps.push(peep);
        };

        const addPeepToCrowd = () => {
            if (!availablePeeps.length) return null;

            const peep = removeRandomFromArray(availablePeeps);
            const { endX, startY } = resetPeep(peep);
            const xDuration = 10;
            const yDuration = 0.25;

            const walk = gsap.timeline();
            walk.timeScale(randomRange(0.5, 1.5));
            walk.to(peep, { duration: xDuration, x: endX, ease: 'none' }, 0);
            walk.to(peep, {
                duration: yDuration,
                repeat: xDuration / yDuration,
                yoyo: true,
                y: startY - 10,
            }, 0);
            walk.eventCallback('onComplete', () => {
                removePeepFromCrowd(peep);
                addPeepToCrowd();
            });

            peep.walk = walk;
            crowd.push(peep);
            crowd.sort((a, b) => a.anchorY - b.anchorY);

            if (prefersReducedMotion) {
                walk.progress(Math.random()).pause();
            }

            return peep;
        };

        const initCrowd = () => {
            while (availablePeeps.length) {
                const peep = addPeepToCrowd();
                peep?.walk?.progress(Math.random());
            }
        };

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(stage.dpr, stage.dpr);
            crowd.forEach((peep) => peep.render(ctx));
            ctx.restore();
        };

        const resize = () => {
            stage.width = canvas.clientWidth;
            stage.height = canvas.clientHeight;
            stage.dpr = window.devicePixelRatio || 1;

            canvas.width = stage.width * stage.dpr;
            canvas.height = stage.height * stage.dpr;

            crowd.forEach((peep) => peep.walk?.kill());
            crowd.length = 0;
            availablePeeps.length = 0;
            availablePeeps.push(...allPeeps);
            initCrowd();
            render();
        };

        const init = () => {
            if (initialized) return;
            initialized = true;
            createPeeps();
            resize();
            if (!prefersReducedMotion) {
                gsap.ticker.add(render);
            }
        };

        const handleResize = () => {
            if (initialized) resize();
        };

        image.onload = init;
        image.src = src;
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            gsap.ticker.remove(render);
            crowd.forEach((peep) => peep.walk?.kill());
        };
    }, [cols, rows, src]);

    return (
        <canvas
            ref={canvasRef}
            className={`block w-full ${className}`}
            style={{ height: `${height}px` }}
        />
    );
};

export default CanvasCrowd;

/**
 * Adapted from Skiper UI's "Canvas crowd" component:
 * https://skiper-ui.com/v1/skiper39
 *
 * Inspired by Zach Saucier's CodePen and illustrated with Open Peeps:
 * https://codepen.io/zadvorsky/pen/xxwbBQV
 * https://www.openpeeps.com/
 */
