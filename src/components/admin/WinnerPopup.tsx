'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { DrawResponse } from '@/types';

interface WinnerPopupProps {
  open: boolean;
  onClose: () => void;
  onContinue?: () => void;
  drawResult: DrawResponse | null;
  matchingDigits: number;
}

/**
 * WinnerPopup Component
 *
 * Displays winner announcement modal after draw completes.
 * Shows winning number and list of winners with their ticket numbers.
 */
export function WinnerPopup({
  open,
  onClose,
  onContinue,
  drawResult,
  matchingDigits,
}: WinnerPopupProps) {
  useEffect(() => {
    if (open && drawResult) {
      const duration = 2500;
      const end = Date.now() + duration;
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [open, drawResult]);

  if (!drawResult) return null;

  const displayNumber = drawResult.winningNumber.padStart(matchingDigits, '0');
  const hasWinners = drawResult.winners.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Chúc mừng! Số trúng thưởng</DialogTitle>
          <DialogDescription>
            {drawResult.draftMode
              ? 'Đây là lượt quay thử. Kết quả chưa được lưu.'
              : 'Kết quả đã được lưu vào hệ thống.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Winning Number Display */}
          <div className="rounded-lg border-2 border-blue-500 bg-blue-50 p-6 text-center">
            <div className="mb-2 text-sm font-medium text-muted-foreground">Số trúng giải</div>
            <div className="font-mono text-5xl font-bold text-blue-900">{displayNumber}</div>
          </div>

          {/* Winners List */}
          {hasWinners ? (
            <div className="space-y-3">
              <div className="text-sm font-medium">
                Người trúng giải ({drawResult.winners.length}):
              </div>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {drawResult.winners.map((winner) => (
                  <div
                    key={winner.userId}
                    className="rounded-lg border bg-card p-4"
                  >
                    <div className="font-semibold">{winner.name}</div>
                    <div className="text-sm text-muted-foreground">{winner.email}</div>
                    {winner.phone && (
                      <div className="text-sm text-muted-foreground">{winner.phone}</div>
                    )}
                    <div className="mt-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Số vé trúng ({winner.tickets.length}):
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {winner.tickets.map((ticket) => (
                          <span
                            key={ticket.id}
                            className="rounded bg-blue-100 px-2 py-1 font-mono text-xs font-semibold text-blue-900"
                          >
                            {ticket.ticketNumber}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
              <div className="text-lg font-semibold text-yellow-900">
                Không có vé trúng giải
              </div>
              <div className="mt-1 text-sm text-yellow-700">
                Không có vé nào khớp với số trúng giải này.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          {onContinue && (
            <Button onClick={onContinue} variant="default">
              Quay giải tiếp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
