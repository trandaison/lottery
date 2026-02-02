'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Square } from 'lucide-react';

export interface SingleDigitWheelProps {
  /** Digits that can appear (unique). */
  digits: number[];
  /** Wheel is cycling (from wrapper). */
  isRunning: boolean;
  /** This wheel is allowed to be stopped (only the current wheel in order). */
  canStop: boolean;
  /** Called when user stops on this digit. */
  onStop: (digit: number) => void;
  /** Interval in ms between digit changes. */
  intervalMs: number;
  /** Disable controls (e.g. while submitting). */
  disabled?: boolean;
  /** Hiển thị icon check (chỉ khi đã dừng quay tại số này). */
  showCheck?: boolean;
}

export interface SingleDigitWheelRef {
  /** Stop at current digit and call onStop (e.g. from Space key). */
  stopNow: () => void;
}

/** Fixed height for button row to avoid layout shift when button is shown/hidden. */
const BUTTON_ROW_HEIGHT = 40;

/**
 * SingleDigitWheel: one slot showing one digit.
 * - Empty digits → show "-", placeholder keeps height.
 * - One digit → show it, icon button (disabled) keeps height.
 * - More than one → cycle when isRunning; icon Stop button always visible, enabled only when canStop && isRunning.
 */
export const SingleDigitWheel = forwardRef<SingleDigitWheelRef, SingleDigitWheelProps>(function SingleDigitWheel(
  { digits, isRunning, canStop, onStop, intervalMs, disabled = false, showCheck = false },
  ref
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useImperativeHandle(ref, () => ({
    stopNow() {
      if (digits.length === 0) return;
      if (digits.length === 1) {
        onStop(digits[0]!);
        return;
      }
      const digit = digits[currentIndex];
      if (digit !== undefined) onStop(digit);
    },
  }), [digits, currentIndex, onStop]);

  /** Reset index khi mảng digits thay đổi (sau khi filter candidates theo suffix), tránh index vượt quá. */
  useEffect(() => {
    setCurrentIndex(0);
  }, [digits.length]);

  useEffect(() => {
    if (!isRunning || digits.length <= 1) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % digits.length);
    }, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, digits.length, intervalMs]);

  const handleStop = () => {
    if (digits.length === 0) return;
    if (digits.length === 1) {
      onStop(digits[0]!);
      return;
    }
    const digit = digits[currentIndex];
    if (digit !== undefined) onStop(digit);
  };

  const showStopButton = digits.length > 1;
  const stopEnabled = showStopButton && canStop && isRunning && !disabled;

  if (digits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex h-32 w-24 items-center justify-center rounded-lg border-4 border-gray-300 bg-gray-100 text-4xl font-bold text-muted-foreground"
          aria-label="Vị trí trống"
        >
          -
        </div>
        <div className="flex h-[var(--btn-row)] items-center justify-center" style={{ height: BUTTON_ROW_HEIGHT }} aria-hidden />
      </div>
    );
  }

  if (digits.length === 1) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex h-32 w-24 items-center justify-center rounded-lg border-4 border-blue-500 bg-gradient-to-b from-blue-50 to-blue-100 text-6xl font-bold text-blue-900 shadow-lg"
          aria-label={`Chữ số ${digits[0]}`}
        >
          {digits[0]}
        </div>
        <div className="h-10 w-10 shrink-0 flex items-center justify-center text-muted-foreground text-2xl font-bold" style={{ minHeight: BUTTON_ROW_HEIGHT }} aria-hidden>
          {showCheck ? <Check className="h-5 w-5 text-green-500" /> : '-'}
        </div>
      </div>
    );
  }

  const displayDigit = digits[currentIndex] ?? digits[0];

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex h-32 w-24 items-center justify-center rounded-lg border-4 border-blue-500 bg-gradient-to-b from-blue-50 to-blue-100 text-6xl font-bold text-blue-900 shadow-lg"
        aria-label={`Đang hiển thị ${displayDigit}`}
      >
        {displayDigit}
      </div>
      <Button
        variant="destructive"
        size="icon"
        onClick={handleStop}
        disabled={!stopEnabled}
        aria-label="Dừng tại số này"
        className="h-10 w-10 shrink-0"
      >
        <Square className="h-5 w-5" />
      </Button>
    </div>
  );
});
