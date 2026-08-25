import { useEffect, useRef } from 'react';

const TRAIL_LENGTH = 12;

export function CursorTrail() {
  const trailRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef(Array.from({ length: TRAIL_LENGTH }, () => ({ x: -100, y: -100 })));
  const targetRef = useRef({ x: -100, y: -100 });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const trail = trailRef.current;
    if (!trail) return;

    const nodes = Array.from(trail.children) as HTMLElement[];
    const handlePointerMove = (event: PointerEvent) => {
      targetRef.current = { x: event.clientX, y: event.clientY };
    };

    const animate = () => {
      let previous = targetRef.current;
      pointsRef.current = pointsRef.current.map((point, index) => {
        const easing = index === 0 ? 0.32 : 0.2;
        const next = {
          x: point.x + (previous.x - point.x) * easing,
          y: point.y + (previous.y - point.y) * easing,
        };
        previous = next;
        return next;
      });

      pointsRef.current.forEach((point, index) => {
        const node = nodes[index];
        if (!node) return;
        node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) scale(${1 - index * 0.055})`;
        node.style.opacity = `${Math.max(0, 0.72 - index * 0.055)}`;
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div ref={trailRef} className="cursor-trail" aria-hidden="true">
      {Array.from({ length: TRAIL_LENGTH }, (_, index) => (
        <span key={index} className="cursor-trail__particle" />
      ))}
      <span className="cursor-trail__aura" />
    </div>
  );
}