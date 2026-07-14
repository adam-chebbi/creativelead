import { useState, useEffect } from 'react';
import { useReducedMotion } from './useReducedMotion';

export function useCountUp(endValue: number, durationMs: number = 600): number {
  const [value, setValue] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setValue(endValue);
      return;
    }
    
    let startTimestamp: number;
    let animationFrame: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      
      setValue(Math.floor(progress * endValue));

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      }
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [endValue, durationMs, prefersReducedMotion]);

  return value;
}
