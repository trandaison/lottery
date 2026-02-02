'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SingleDigitWheel, type SingleDigitWheelRef } from '@/components/admin/SingleDigitWheel';
import { getDigitArrayForPosition } from '@/lib/utils/draw';

const FPS_OPTIONS = [120, 60, 30, 24, 16, 8, 4] as const;
const DEFAULT_FPS = 8;

export interface DrawWheelGroupProps {
  /** Candidate numbers (each 6 digits from server). */
  numbers: string[];
  /** Number of digits that match the prize (for display). */
  matchingDigits: number;
  /** Whether to exclude digits that would match winning number suffixes. */
  excludeWinningNumbers: boolean;
  /** Winning number strings padded to 6 chars for comparison (when excludeWinningNumbers). */
  winningNumberSuffixes: string[];
  /** Called when all 6 wheels have stopped; argument is 6-digit string (or with '-' for empty slots). */
  onComplete: (winningNumber: string) => void;
  /** Disable controls (e.g. while submitting). */
  disabled?: boolean;
}

/**
 * DrawWheelGroup: 6 SingleDigitWheels (left = position 5, right = position 0).
 * Start from wrapper; stop order right → left. Space: start or stop one wheel.
 */
export function DrawWheelGroup({
  numbers,
  matchingDigits,
  excludeWinningNumbers,
  winningNumberSuffixes,
  onComplete,
  disabled = false,
}: DrawWheelGroupProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [nextStoppableIndex, setNextStoppableIndex] = useState(0);
  const [finalDigits, setFinalDigits] = useState<(number | null)[]>(
    () => Array(6).fill(null) as (number | null)[]
  );
  const [fpsHz, setFpsHz] = useState(DEFAULT_FPS);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRefs = useRef<(SingleDigitWheelRef | null)[]>([]);
  const completedRef = useRef(false);

  const intervalMs = 1000 / fpsHz;

  /** Normalize so all numbers are 6 digits (avoid empty columns when API returns e.g. "10575"). */
  const numbers6 = useMemo(
    () => numbers.map((n) => n.padStart(6, '0').slice(-6)),
    [numbers]
  );

  /**
   * Đuôi số đã fix (last L digits of the 6-digit number, left-to-right).
   * finalDigits[0]=trái nhất, finalDigits[5]=phải nhất. Số = finalDigits[0]..finalDigits[5].
   * slice(-L) của số = finalDigits[6-L]..finalDigits[5] → suffixSoFar phải là chuỗi theo thứ tự đó để n.slice(-L) === suffixSoFar.
   */
  const suffixSoFar = useMemo(() => {
    let L = 0;
    for (let i = 5; i >= 0; i--) {
      if (finalDigits[i] === null) break;
      L++;
    }
    if (L === 0) return '';
    return finalDigits
      .slice(6 - L, 6)
      .map((d) => String(d!))
      .join('');
  }, [finalDigits]);

  /**
   * Filter candidates by suffix (endWith): khi có số bên phải đã dừng, chỉ giữ candidates có đuôi khớp.
   * - suffixSoFar.length === 0 → dùng toàn bộ numbers6.
   * - suffixSoFar.length === L → filteredCandidates = numbers6.filter(n => n.slice(-L) === suffixSoFar).
   */
  const filteredCandidates = useMemo(() => {
    const L = suffixSoFar.length;
    if (L === 0) return numbers6;
    return numbers6.filter((n) => n.slice(-L) === suffixSoFar);
  }, [numbers6, suffixSoFar]);

  /**
   * 6 mảng chữ số cho 6 cột (phải = 0, trái = 5).
   * - Cột pos >= matchingDigits (bên trái không dùng): hiển thị "-" (mảng rỗng).
   * - Cột 0..matchingDigits-1: tính từ candidates như cũ.
   */
  const digitArraysForDisplay = useMemo(() => {
    const arr: number[][] = [];
    for (let pos = 0; pos < 6; pos++) {
      if (pos >= matchingDigits) {
        arr.push([]);
        continue;
      }
      const suffix =
        pos === 0 || suffixSoFar.length < pos
          ? undefined
          : suffixSoFar.slice(-pos);
      const digits = getDigitArrayForPosition(
        numbers6,
        pos,
        suffix,
        undefined,
        false
      );
      arr.push(digits);
    }
    return arr;
  }, [numbers6, suffixSoFar, matchingDigits]);

  const canStart = useMemo(() => {
    return digitArraysForDisplay.some((d) => d.length > 1);
  }, [digitArraysForDisplay]);

  const handleStart = useCallback(() => {
    if (!canStart || disabled) return;
    completedRef.current = false;
    setIsRunning(true);
    setNextStoppableIndex(0);
    setFinalDigits(Array(6).fill(null) as (number | null)[]);
  }, [canStart, disabled]);

  const handleWheelStop = useCallback(
    (wheelIndex: number, digit: number) => {
      setFinalDigits((prev) => {
        const next = [...prev];
        next[5 - wheelIndex] = digit;
        return next;
      });
      setNextStoppableIndex((i) => i + 1);
    },
    []
  );

  useEffect(() => {
    if (nextStoppableIndex < 6) return;
    if (completedRef.current) return;
    completedRef.current = true;
    setIsRunning(false);
    const winningNumber = finalDigits
      .map((d) => (d === null ? '0' : String(d)))
      .join('');
    onComplete(winningNumber);
  }, [nextStoppableIndex, finalDigits, onComplete]);

  /** Vị trí nào chỉ có 1 candidate (length <= 1) thì stop ô đó luôn, không quay; advance đến ô tiếp theo. */
  useEffect(() => {
    if (nextStoppableIndex >= 6) return;
    const digits = digitArraysForDisplay[nextStoppableIndex] ?? [];
    if (digits.length > 1) return;
    if (digits.length === 1) {
      setFinalDigits((prev) => {
        const next = [...prev];
        next[5 - nextStoppableIndex] = digits[0]!;
        return next;
      });
      setNextStoppableIndex((i) => i + 1);
    } else {
      setFinalDigits((prev) => {
        const next = [...prev];
        next[5 - nextStoppableIndex] = null;
        return next;
      });
      setNextStoppableIndex((i) => i + 1);
    }
  }, [nextStoppableIndex, digitArraysForDisplay]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== ' ' || disabled) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
      if (!isRunning) {
        handleStart();
        return;
      }
      const wheelIndex = nextStoppableIndex;
      if (wheelIndex >= 6) return;
      wheelRefs.current[wheelIndex]?.stopNow();
    },
    [disabled, isRunning, nextStoppableIndex, handleStart]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const wheelIndicesLeftToRight = [5, 4, 3, 2, 1, 0];

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4">
      <div className="flex gap-2 items-end">
        {wheelIndicesLeftToRight.map((wheelIndex) => {
          const fixedDigit = finalDigits[5 - wheelIndex];
          const digits =
            fixedDigit !== null
              ? [fixedDigit]
              : (digitArraysForDisplay[wheelIndex] ?? []);
          return (
            <SingleDigitWheel
              key={wheelIndex}
              ref={(r) => {
                wheelRefs.current[wheelIndex] = r;
              }}
              digits={digits}
              isRunning={
                isRunning &&
                fixedDigit === null &&
                (digitArraysForDisplay[wheelIndex]?.length ?? 0) > 1
              }
              canStop={
                nextStoppableIndex === wheelIndex &&
                (digitArraysForDisplay[wheelIndex]?.length ?? 0) > 1
              }
              onStop={(digit) => handleWheelStop(wheelIndex, digit)}
              intervalMs={intervalMs}
              disabled={disabled}
            />
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 flex-wrap">
        {!isRunning && (
          <Button onClick={handleStart} disabled={!canStart || disabled} size="lg">
            Quay số
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Label htmlFor="fps-select" className="text-sm text-muted-foreground">
            Tần số quay:
          </Label>
          <Select
            value={String(fpsHz)}
            onValueChange={(v) => setFpsHz(Number(v) as typeof FPS_OPTIONS[number])}
          >
            <SelectTrigger id="fps-select" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FPS_OPTIONS.map((f) => (
                <SelectItem key={f} value={String(f)}>
                  {f} Hz
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground text-center max-w-md">
        Phím Space: Bắt đầu quay; khi đang quay nhấn Space để dừng từng số (từ phải sang trái).
      </p>

      {/* Debug: 6 mảng cột + mảng cột đang quay */}
      <div className="mt-6 w-full max-w-2xl rounded-lg border border-amber-200 bg-amber-50/80 p-4 font-mono text-xs">
        <div className="mb-2 font-semibold text-amber-900">Debug (6 mảng cột)</div>
        <div className="space-y-1 text-amber-900">
          {digitArraysForDisplay.map((arr, pos) => (
            <div key={pos}>
              <span className="font-medium">Cột {pos}</span>
              <span className="ml-2 text-amber-700">
                ({pos === 0 ? 'phải nhất' : pos === 5 ? 'trái nhất' : ''}) [{arr.join(', ')}]
              </span>
              {arr.length === 0 && (
                <span className="ml-2 text-red-600">→ rỗng (sẽ hiển thị &quot;-&quot;)</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-amber-200 pt-2 font-semibold text-amber-900">
          Cột đang quay (nextStoppableIndex={nextStoppableIndex}):
          <span className="ml-2 font-normal text-amber-700">
            {isRunning && nextStoppableIndex < 6
              ? `[${(digitArraysForDisplay[nextStoppableIndex] ?? []).join(', ')}]`
              : ' —'}
          </span>
        </div>
        <div className="mt-2 border-t border-amber-200 pt-2 text-amber-700">
          filteredCandidates (endWith &quot;{suffixSoFar || '(chưa có)'}&quot;): {filteredCandidates.length} số
        </div>
      </div>
    </div>
  );
}
