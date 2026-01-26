'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.locale('vi');

interface CountdownTimerProps {
  targetDate: Date;
  onComplete?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * CountdownTimer Component
 * 
 * Displays a countdown timer to a target date with:
 * - Real-time updates every second
 * - Days, hours, minutes, seconds display
 * - Callback when countdown completes
 * 
 * Architecture:
 * - Single responsibility: Display countdown
 * - Custom hook could be extracted if reused with different UI
 * - Uses dayjs for date manipulation
 */
export function CountdownTimer({ targetDate, onComplete }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Calculate time left
    const calculateTimeLeft = (): TimeLeft | null => {
      const now = dayjs();
      const target = dayjs(targetDate);
      const diff = target.diff(now);

      if (diff <= 0) {
        return null;
      }

      const durationLeft = dayjs.duration(diff);
      return {
        days: Math.floor(durationLeft.asDays()),
        hours: durationLeft.hours(),
        minutes: durationLeft.minutes(),
        seconds: durationLeft.seconds(),
      };
    };

    // Initial calculation
    const initial = calculateTimeLeft();
    setTimeLeft(initial);

    if (!initial) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    // Update every second
    const interval = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (!newTimeLeft && !isComplete) {
        setIsComplete(true);
        onComplete?.();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onComplete, isComplete]);

  if (isComplete || !timeLeft) {
    return (
      <div className="text-center p-6 bg-gray-50 rounded-lg">
        <p className="text-lg font-medium text-gray-600">
          Thời gian đã đến!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
      <h3 className="text-center text-lg font-medium mb-4">
        Thời gian còn lại
      </h3>
      <div className="grid grid-cols-4 gap-4">
        <TimeUnit value={timeLeft.days} label="Ngày" />
        <TimeUnit value={timeLeft.hours} label="Giờ" />
        <TimeUnit value={timeLeft.minutes} label="Phút" />
        <TimeUnit value={timeLeft.seconds} label="Giây" />
      </div>
    </div>
  );
}

interface TimeUnitProps {
  value: number;
  label: string;
}

function TimeUnit({ value, label }: TimeUnitProps) {
  return (
    <div className="text-center">
      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 mb-2">
        <span className="text-3xl font-bold tabular-nums">
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <p className="text-sm font-medium opacity-90">{label}</p>
    </div>
  );
}
