'use client';

import { useEffect, useRef, useState } from 'react';

interface RandomNumberAnimatorProps {
  numbers: string[];
  fps?: number;
}

export default function RandomNumberAnimator({
  numbers,
  fps = 8,
}: RandomNumberAnimatorProps) {
  const [current, setCurrent] = useState(numbers[0] ?? '000000');

  const runningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const frameInterval = 1000 / fps;

  const animate = (time: number) => {
    if (!runningRef.current) return;

    if (time - lastTimeRef.current >= frameInterval) {
      lastTimeRef.current = time;

      const randomIndex = Math.floor(Math.random() * numbers.length);
      setCurrent(numbers[randomIndex]);
    }

    rafRef.current = requestAnimationFrame(animate);
  };

  const start = () => {
    if (runningRef.current) return;

    runningRef.current = true;
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);
  };

  const stop = () => {
    runningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: 48,
          fontFamily: "monospace",
          marginBottom: 16,
        }}
      >
        {current}
      </div>

      <button type="button" onClick={start} style={{ marginRight: 8 }}>
        Start
      </button>
      <button type="button" onClick={stop}>Stop</button>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
        FPS: {fps}
      </div>
    </div>
  );
}
