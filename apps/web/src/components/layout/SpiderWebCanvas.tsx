import { useEffect, useRef, type RefObject } from "react";

interface SpiderNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  cyan: boolean;
}

interface SpiderWebCanvasProps {
  hostRef: RefObject<HTMLElement | null>;
  className?: string;
}

function frac(n: number): number {
  return n - Math.floor(n);
}

/**
 * Interactive cosmic spider-web constellation rendered inside the hero header.
 * Responds organically to pointer movement without intercepting clicks
 * and renders a single static constellation when `prefers-reduced-motion` is set.
 */
export function SpiderWebCanvas({ hostRef, className = "sf-hero-fx" }: SpiderWebCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionQuery.matches;

    let width = host.clientWidth || window.innerWidth;
    let height = host.clientHeight || 640;
    let nodes: SpiderNode[] = [];
    let rafId = 0;

    const pointer = { x: -9999, y: -9999, active: false };

    const seedNodes = (w: number, h: number): SpiderNode[] => {
      const targetCount =
        h > 220
          ? Math.max(46, Math.min(82, Math.round((w * h) / 14500)))
          : Math.max(20, Math.min(44, Math.round(w / 34)));

      const created: SpiderNode[] = [];
      for (let i = 0; i < targetCount; i += 1) {
        const angle = (i * 2.39996) % (Math.PI * 2);
        const speed = h > 220 ? 0.22 + (i % 5) * 0.055 : 0.14 + (i % 5) * 0.04;
        const ux = frac((i + 1) * 0.61803398875);
        const uy = frac((i + 1) * 0.38196601125 + Math.sin(i * 1.7) * 0.13);

        created.push({
          x: 20 + ux * Math.max(40, w - 40),
          y: 16 + uy * Math.max(32, h - 32),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: i % 5 === 0 ? 2.15 : 1.35,
          cyan: i % 4 === 0,
        });
      }
      return created;
    };

    const resize = () => {
      width = Math.max(1, host.clientWidth || window.innerWidth);
      height = Math.max(1, host.clientHeight || 640);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = seedNodes(width, height);
    };

    const drawFrame = (stepPhysics: boolean) => {
      ctx.clearRect(0, 0, width, height);

      const isHero = height > 220;
      const maxEdgeDist = isHero ? 156 : 112;
      const maxEdgeDistSq = maxEdgeDist * maxEdgeDist;
      const pointerRadius = isHero ? 215 : 150;
      const pointerRadiusSq = pointerRadius * pointerRadius;

      if (stepPhysics) {
        for (const node of nodes) {
          node.x += node.vx;
          node.y += node.vy;

          if (node.x < 8) {
            node.x = 8;
            node.vx = Math.abs(node.vx);
          } else if (node.x > width - 8) {
            node.x = width - 8;
            node.vx = -Math.abs(node.vx);
          }

          if (node.y < 8) {
            node.y = 8;
            node.vy = Math.abs(node.vy);
          } else if (node.y > height - 8) {
            node.y = height - 8;
            node.vy = -Math.abs(node.vy);
          }

          if (pointer.active) {
            const dx = pointer.x - node.x;
            const dy = pointer.y - node.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > 64 && distSq < pointerRadiusSq) {
              node.x += dx * 0.0024;
              node.y += dy * 0.0024;
            }
          }
        }
      }

      if (pointer.active) {
        const halo = ctx.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          pointerRadius * 0.72,
        );
        halo.addColorStop(0, "rgba(139, 92, 246, 0.16)");
        halo.addColorStop(0.55, "rgba(103, 232, 249, 0.05)");
        halo.addColorStop(1, "rgba(5, 5, 11, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(
          Math.max(0, pointer.x - pointerRadius),
          Math.max(0, pointer.y - pointerRadius),
          pointerRadius * 2,
          pointerRadius * 2,
        );
      }

      // Spider-web node filaments
      ctx.lineWidth = isHero ? 0.9 : 0.8;
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dSq = dx * dx + dy * dy;
          if (dSq >= maxEdgeDistSq) {
            continue;
          }
          const strength = 1 - Math.sqrt(dSq) / maxEdgeDist;
          const alpha = 0.05 + strength * 0.24;
          ctx.strokeStyle =
            a.cyan && b.cyan
              ? `rgba(103, 232, 249, ${(alpha * 0.82).toFixed(3)})`
              : `rgba(167, 139, 250, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Interactive radial web strands linking hovered cursor to nearby nodes
      if (pointer.active) {
        ctx.lineWidth = 1.1;
        for (const node of nodes) {
          const dx = pointer.x - node.x;
          const dy = pointer.y - node.y;
          const dSq = dx * dx + dy * dy;
          if (dSq >= pointerRadiusSq) {
            continue;
          }
          const strength = 1 - Math.sqrt(dSq) / pointerRadius;
          const alpha = 0.14 + strength * 0.45;
          ctx.strokeStyle = node.cyan
            ? `rgba(103, 232, 249, ${alpha.toFixed(3)})`
            : `rgba(196, 181, 253, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(pointer.x, pointer.y);
          ctx.lineTo(node.x, node.y);
          ctx.stroke();
        }
      }

      // Cosmic vertices
      for (const node of nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.cyan
          ? "rgba(103, 232, 249, 0.58)"
          : "rgba(196, 181, 253, 0.52)";
        ctx.fill();
      }
    };

    const tick = () => {
      drawFrame(!reduceMotion);
      if (!reduceMotion) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
      if (reduceMotion) {
        drawFrame(false);
      }
    };

    const handlePointerLeave = () => {
      pointer.active = false;
      if (reduceMotion) {
        drawFrame(false);
      }
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
      window.cancelAnimationFrame(rafId);
      if (reduceMotion) {
        drawFrame(false);
      } else {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    resize();
    if (reduceMotion) {
      drawFrame(false);
    } else {
      rafId = window.requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) {
        drawFrame(false);
      }
    });
    observer.observe(host);

    host.addEventListener("pointermove", handlePointerMove);
    host.addEventListener("pointerleave", handlePointerLeave);
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
      host.removeEventListener("pointermove", handlePointerMove);
      host.removeEventListener("pointerleave", handlePointerLeave);
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, [hostRef]);

  return (
    <div className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="sf-spiderweb-canvas" />
    </div>
  );
}
