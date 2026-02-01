'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, animate, useMotionValue, useSpring } from 'framer-motion';

interface ScrollingMeterProps {
  targetNumber: string | null;
  matchingDigits: number;
  isAnimating: boolean;
  onAnimationComplete?: () => void;
}

/**
 * ScrollingMeter Component
 *
 * Displays a 6-digit scrolling meter with smooth number counter animation.
 * - Each digit animates from 0-9 continuously when scrolling
 * - When targetNumber is set, digits stop from right to left with spring animation
 * - Left digits stay "0" if matchingDigits < 6
 * - Uses framer-motion animate function for smooth counter animation
 */
export function ScrollingMeter({
  targetNumber,
  matchingDigits,
  isAnimating,
  onAnimationComplete,
}: ScrollingMeterProps) {
  const [displayDigits, setDisplayDigits] = useState<string[]>(['0', '0', '0', '0', '0', '0']);
  const [isStopping, setIsStopping] = useState(false);
  const animationControlsRef = useRef<Array<ReturnType<typeof animate> | null>>([]);
  const digitRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Calculate which digits should be animated based on matchingDigits
  const startIndex = 6 - matchingDigits; // e.g., matchingDigits=3 → startIndex=3 (digits 3,4,5)

  // Continuous scrolling animation for each digit
  useEffect(() => {
    if (!isAnimating || isStopping) {
      // Stop all animations
      animationControlsRef.current.forEach((control) => {
        if (control) {
          control.stop();
        }
      });
      animationControlsRef.current = [];
      return;
    }

    // Animate each digit from 0-9 continuously
    const controls: Array<ReturnType<typeof animate> | null> = [];
    for (let i = startIndex; i < 6; i++) {
      const digitIndex = i;
      const animateDigit = () => {
        const control = animate(0, 9, {
          duration: 0.5 + Math.random() * 0.5, // Random duration between 0.5-1s for variety
          ease: 'linear',
          repeat: Infinity,
          onUpdate(value) {
            setDisplayDigits((prev) => {
              const newDigits = [...prev];
              newDigits[digitIndex] = String(Math.floor(value) % 10);
              return newDigits;
            });
          },
        });
        controls[digitIndex] = control;
      };
      animateDigit();
    }

    animationControlsRef.current = controls;

    return () => {
      controls.forEach((control) => {
        if (control) {
          control.stop();
        }
      });
    };
  }, [isAnimating, startIndex, isStopping]);

  // Stop animation when targetNumber is provided
  useEffect(() => {
    if (targetNumber && isAnimating && !isStopping) {
      setIsStopping(true);

      // Stop all continuous animations
      animationControlsRef.current.forEach((control) => {
        if (control) {
          control.stop();
        }
      });
      animationControlsRef.current = [];

      // Pad targetNumber to 6 digits (left-pad with zeros)
      const paddedTarget = targetNumber.padStart(6, '0');
      const targetDigits = paddedTarget.split('').map(Number);

      // Animate stopping from right to left with spring animation
      const totalDuration = 5000; // 5 seconds total
      const delayPerDigit = totalDuration / matchingDigits;
      let completedCount = 0;

      for (let i = 5; i >= startIndex; i--) {
        const digitIndex = i;
        const targetValue = targetDigits[digitIndex];
        const currentValue = parseInt(displayDigits[digitIndex] || '0', 10);

        // Calculate animation delay (rightmost digit stops first)
        const delay = (5 - i) * delayPerDigit;

        setTimeout(() => {
          // Calculate the shortest path (handle wrap-around)
          // e.g., if current=8 and target=2, animate 8→9→0→1→2 (4 steps forward)
          // instead of 8→7→6→5→4→3→2 (6 steps backward)
          let fromValue = currentValue;
          let toValue = targetValue;

          // Calculate both paths
          const backwardSteps = fromValue > toValue ? fromValue - toValue : 0;
          const forwardSteps = fromValue < toValue ? toValue - fromValue : 10 - fromValue + toValue;

          // If forward path with wrap-around is shorter, use it
          if (backwardSteps > 0 && forwardSteps < backwardSteps) {
            // Animate forward with wrap-around: fromValue → 9 → 0 → targetValue
            toValue = targetValue + 10;
          }

          // Animate to target value with spring
          const control = animate(fromValue, toValue, {
            duration: 0.8,
            ease: [0.16, 1, 0.3, 1], // Custom easing for smooth deceleration
            onUpdate(value) {
              setDisplayDigits((prev) => {
                const newDigits = [...prev];
                // Handle wrap-around using modulo
                let displayValue = Math.floor(value) % 10;
                if (displayValue < 0) displayValue = (displayValue + 10) % 10;
                newDigits[digitIndex] = String(displayValue);
                return newDigits;
              });
            },
            onComplete() {
              // Ensure final value is correct
              setDisplayDigits((prev) => {
                const newDigits = [...prev];
                newDigits[digitIndex] = String(targetValue);
                return newDigits;
              });

              completedCount++;
              // When all digits have stopped, call completion callback
              if (completedCount === matchingDigits) {
                setTimeout(() => {
                  setIsStopping(false);
                  onAnimationComplete?.();
                }, 300);
              }
            },
          });

          animationControlsRef.current[digitIndex] = control;
        }, delay);
      }
    }
  }, [targetNumber, isAnimating, matchingDigits, startIndex, isStopping, onAnimationComplete]);

  // Reset when not animating
  useEffect(() => {
    if (!isAnimating && !targetNumber) {
      setDisplayDigits(['0', '0', '0', '0', '0', '0']);
      setIsStopping(false);
    }
  }, [isAnimating, targetNumber]);

  return (
    <div className="flex items-center justify-center">
      <div className="flex gap-4">
        {displayDigits.map((digit, index) => {
          const isAnimated = index >= startIndex;
          const isStatic = index < startIndex;

          return (
            <motion.div
              key={index}
              ref={(el) => {
                digitRefs.current[index] = el;
              }}
              className={`
                flex h-32 w-24 items-center justify-center rounded-lg border-4
                bg-gradient-to-b from-blue-50 to-blue-100
                text-6xl font-bold text-blue-900
                shadow-lg transition-all duration-300
                ${isAnimated ? 'border-blue-500' : 'border-gray-300'}
                ${isStatic ? 'bg-gray-100' : ''}
              `}
              animate={
                isAnimated && isAnimating && !isStopping
                  ? {
                      scale: [1, 1.05, 1],
                      transition: {
                        duration: 0.4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                    }
                  : {}
              }
            >
              {digit}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
