'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface FloatingSpiderCharmProps {
  strapType?: 'purple-strap' | 'web-thread';
  restLength?: number;
  spiderWidth?: number;
  interactive?: boolean;
  charmSrc?: string;
  charmAlt?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  onHoverChange?: (isHovered: boolean) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export default function FloatingSpiderCharm({
  strapType = 'purple-strap',
  restLength = 65,
  spiderWidth = 125,
  interactive = true,
  charmSrc = '/spider-charm.png',
  charmAlt = 'Hanging Charm',
  onContextMenu,
  onHoverChange,
  onDragStateChange,
}: FloatingSpiderCharmProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Position state (X, Y displacement relative to top anchor center)
  const [pos, setPos] = useState({ x: 0, y: restLength });
  const [tilt, setTilt] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Physics simulation refs
  const posRef = useRef({ x: 0, y: restLength });
  const velRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pointerStartPosRef = useRef({ x: 0, y: 0 });
  const velocityHistoryRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const containerWidth = 320;
  const anchorX = containerWidth / 2; // 160
  const anchorY = 0;

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onHoverChange?.(true);
  }, [onHoverChange]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (!isDraggingRef.current) {
      onHoverChange?.(false);
    }
  }, [onHoverChange]);

  // Pointer down on spider initiates pull-and-release drag
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive || e.button !== 0) return; // Only primary button starts drag

    isDraggingRef.current = true;
    setIsDragging(true);
    onDragStateChange?.(true);

    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    dragStartRef.current = { x: posRef.current.x, y: posRef.current.y };
    velRef.current = { x: 0, y: 0 };
    velocityHistoryRef.current = [{ x: posRef.current.x, y: posRef.current.y, time: performance.now() }];

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - pointerStartPosRef.current.x;
      const deltaY = e.clientY - pointerStartPosRef.current.y;

      let newX = Math.max(-140, Math.min(140, dragStartRef.current.x + deltaX));
      let newY = Math.max(25, Math.min(280, dragStartRef.current.y + deltaY));

      posRef.current = { x: newX, y: newY };
      setPos({ x: newX, y: newY });

      const currentAngle = Math.atan2(newX, newY) * (180 / Math.PI);
      setTilt(currentAngle);

      const now = performance.now();
      const history = velocityHistoryRef.current;
      history.push({ x: newX, y: newY, time: now });
      if (history.length > 5) history.shift();
    };

    const handleGlobalPointerUp = () => {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      setIsDragging(false);
      onDragStateChange?.(false);

      // Compute fling release velocity
      const history = velocityHistoryRef.current;
      if (history.length >= 2) {
        const first = history[0];
        const last = history[history.length - 1];
        const dt = Math.max(0.016, (last.time - first.time) / 1000);
        velRef.current = {
          x: Math.max(-800, Math.min(800, (last.x - first.x) / dt)),
          y: Math.max(-1000, Math.min(1000, (last.y - first.y) / dt)),
        };
      }

      if (!isHovered) {
        onHoverChange?.(false);
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [isHovered, onDragStateChange, onHoverChange]);

  // Physics animation loop: 2D Spring-Mass-Damper + Damped Harmonic Oscillation
  useEffect(() => {
    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = now;

      if (!isDraggingRef.current) {
        const t = now * 0.0015;
        const idleX = Math.sin(t * 1.6) * 3.5 + Math.sin(t * 0.7) * 1.5;
        const idleY = restLength + Math.sin(t * 2.8) * 1.2;

        const currentX = posRef.current.x;
        const currentY = posRef.current.y;

        // Spring stiffness (k) and damping (c)
        const kSpringX = 75.0;
        const kSpringY = 85.0;
        const dampingX = 4.8;
        const dampingY = 5.2;

        const displacementX = currentX - idleX;
        const displacementY = currentY - idleY;

        const forceX = -kSpringX * displacementX - dampingX * velRef.current.x;
        const forceY = -kSpringY * displacementY - dampingY * velRef.current.y;

        velRef.current.x += forceX * dt;
        velRef.current.y += forceY * dt;

        const nextX = currentX + velRef.current.x * dt;
        const nextY = Math.max(20, currentY + velRef.current.y * dt);

        posRef.current = { x: nextX, y: nextY };
        setPos({ x: nextX, y: nextY });

        const stringAngle = Math.atan2(nextX, nextY) * (180 / Math.PI);
        const inertialTilt = velRef.current.x * 0.04;
        setTilt(stringAngle + inertialTilt);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [restLength]);

  // Vector geometry from anchor (anchorX, 0) to spider top (anchorX + pos.x, pos.y)
  const spiderTopX = anchorX + pos.x;
  const spiderTopY = pos.y;
  const dx = spiderTopX - anchorX;
  const dy = spiderTopY - anchorY;
  const currentLength = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / currentLength;
  const uy = dy / currentLength;
  const nx = -uy;
  const ny = ux;

  const ribbonWidth = Math.max(7, 14 * Math.pow(restLength / currentLength, 0.35));
  const halfW = ribbonWidth / 2;

  const p1x = anchorX + nx * halfW;
  const p1y = anchorY + ny * halfW;
  const p2x = anchorX - nx * halfW;
  const p2y = anchorY - ny * halfW;
  const p3x = spiderTopX - nx * halfW;
  const p3y = spiderTopY - ny * halfW;
  const p4x = spiderTopX + nx * halfW;
  const p4y = spiderTopY + ny * halfW;

  const ribbonPoints = `${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)} ${p3x.toFixed(1)},${p3y.toFixed(1)} ${p4x.toFixed(1)},${p4y.toFixed(1)}`;
  const stringAngleDeg = (Math.atan2(dx, dy) * 180) / Math.PI;

  return (
    <div
      ref={containerRef}
      className="spider-charm-stage"
      style={{
        width: `${containerWidth}px`,
        height: '420px',
      }}
    >
      {/* 1. Dynamic SVG for Elastic Pull & Release String/Strap */}
      <svg
        className="elastic-string-canvas"
        viewBox={`0 0 ${containerWidth} 420`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="purpleRibbonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3d0057" />
            <stop offset="30%" stopColor="#500071" />
            <stop offset="50%" stopColor="#7a00ab" />
            <stop offset="70%" stopColor="#500071" />
            <stop offset="100%" stopColor="#3d0057" />
          </linearGradient>

          <linearGradient id="silverClampGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3f3f3" />
            <stop offset="35%" stopColor="#c2c2c2" />
            <stop offset="65%" stopColor="#8a8a8a" />
            <stop offset="100%" stopColor="#e8e8e8" />
          </linearGradient>

          <filter id="charmShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.45" />
          </filter>

          <filter id="webThreadGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Top Screen Bezel Bracket */}
        <rect
          x={anchorX - 9}
          y={0}
          width={18}
          height={4}
          rx={1}
          fill="url(#silverClampGrad)"
          filter="url(#charmShadow)"
        />

        {/* Stretchy Hanging String / Ribbon */}
        {strapType === 'web-thread' ? (
          <g filter="url(#webThreadGlow)">
            <line
              x1={anchorX}
              y1={anchorY}
              x2={spiderTopX}
              y2={spiderTopY}
              stroke="rgba(255, 255, 255, 0.95)"
              strokeWidth={Math.max(1.2, 2.4 * Math.pow(restLength / currentLength, 0.5))}
              strokeLinecap="round"
            />
          </g>
        ) : (
          <g>
            <polygon
              points={ribbonPoints}
              fill="url(#purpleRibbonGrad)"
              filter="url(#charmShadow)"
            />
            <g
              transform={`translate(${spiderTopX}, ${spiderTopY}) rotate(${stringAngleDeg})`}
              filter="url(#charmShadow)"
            >
              <rect
                x={-ribbonWidth / 2 - 2}
                y={-6}
                width={ribbonWidth + 4}
                height={7}
                rx={1.5}
                fill="url(#silverClampGrad)"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={0.5}
              />
              <circle
                cx={0}
                cy={2}
                r={3}
                fill="none"
                stroke="url(#silverClampGrad)"
                strokeWidth={1.5}
              />
            </g>
          </g>
        )}
      </svg>

      {/* 2. Hanging Charm Emblem (Interactive Pull & Release Element with Dynamic Texture) */}
      <div
        className="spider-emblem-node"
        style={{
          left: `${spiderTopX}px`,
          top: `${spiderTopY + (strapType === 'purple-strap' ? 4 : 0)}px`,
          width: `${spiderWidth}px`,
          transform: `translate(-50%, 0) rotateZ(${tilt.toFixed(2)}deg) rotateY(${(tilt * 0.35).toFixed(2)}deg)`,
          transformOrigin: 'top center',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={charmSrc}
          src={charmSrc}
          alt={charmAlt}
          className="spider-emblem-image"
          draggable={false}
        />
      </div>

      <style jsx>{`
        .spider-charm-stage {
          position: relative;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          pointer-events: none;
          user-select: none;
          overflow: visible;
        }

        .elastic-string-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: visible;
        }

        .spider-emblem-node {
          position: absolute;
          pointer-events: auto;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          user-select: none;
          will-change: transform, left, top;
          touch-action: none;
        }

        .spider-emblem-node:hover .spider-emblem-image {
          filter: drop-shadow(0 12px 22px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 14px rgba(250, 204, 21, 0.35));
        }

        .spider-emblem-image {
          width: 100%;
          height: auto;
          display: block;
          object-fit: contain;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 10px rgba(234, 179, 8, 0.22));
          transition: filter 0.15s ease, opacity 0.2s ease;
          pointer-events: auto;
          animation: charmFadeIn 0.25s ease-out;
        }

        @keyframes charmFadeIn {
          from {
            opacity: 0.6;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
