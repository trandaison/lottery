'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface DrawWheelProps {
  /** Shuffled list of candidate numbers (suffixes). Display cycles through this in order. */
  numbers: string[];
  /** Number of digits to match (for display padding). */
  matchingDigits: number;
  /** Interval in ms between number changes. */
  intervalMs?: number;
  /** Called when user clicks "Dừng" with the current (winning) number. */
  onStop: (winningNumber: string) => void;
  /** Disabled state (e.g. while submitting). */
  disabled?: boolean;
}

/**
 * DrawWheel: displays numbers from a shuffled list one by one.
 * "Quay số" starts cycling through the list; "Dừng" stops and reports current number.
 */
export function DrawWheel({
  numbers,
  matchingDigits,
  intervalMs = 80,
  onStop,
  disabled = false,
}: DrawWheelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayValue =
    numbers.length > 0 ? numbers[currentIndex]!.padStart(6, '0') : '000000';
  const startIndex = 6 - matchingDigits;

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % numbers.length);
    }, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, numbers.length, intervalMs]);

  const handleStart = () => {
    if (numbers.length === 0) return;
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (numbers.length > 0) {
      onStop(numbers[currentIndex]!);
    }
  };

  if (numbers.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center text-muted-foreground">
        Không có số để quay. Vui lòng chọn giải và tải danh sách số.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex gap-4">
        {displayValue.split('').map((digit, index) => {
          const isActive = index >= startIndex;
          return (
            <div
              key={index}
              className={`
                flex h-32 w-24 items-center justify-center rounded-lg border-4
                bg-gradient-to-b from-blue-50 to-blue-100
                text-6xl font-bold text-blue-900 shadow-lg
                ${isActive ? 'border-blue-500' : 'border-gray-300 bg-gray-100'}
              `}
            >
              {digit}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex gap-3">
        {!isRunning ? (
          <Button onClick={handleStart} disabled={disabled} size="lg">
            Quay số
          </Button>
        ) : (
          <Button onClick={handleStop} variant="destructive" size="lg" disabled={disabled}>
            Dừng
          </Button>
        )}
      </div>
    </div>
  );
}
