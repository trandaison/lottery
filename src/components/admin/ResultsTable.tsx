'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Play, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { PrizeWithDrawStatus } from '@/types';

interface ResultsTableProps {
  prizes: PrizeWithDrawStatus[];
  onDraw: (prizeId: number) => void;
  onRedo: (winningNumberId: number) => void;
  isDrawing: boolean;
  currentDrawingPrizeId: number | null;
}

/**
 * ResultsTable Component
 *
 * Displays prizes with draw status, winning numbers, and action buttons.
 * - Shows placeholders (underscores) for not drawn prizes
 * - Shows loading spinner during draw
 * - Shows winning numbers after draw
 * - Expandable rows to show winners list
 */
export function ResultsTable({
  prizes,
  onDraw,
  onRedo,
  isDrawing,
  currentDrawingPrizeId,
}: ResultsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (prizeId: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(prizeId)) {
        newSet.delete(prizeId);
      } else {
        newSet.add(prizeId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: PrizeWithDrawStatus['drawStatus']) => {
    switch (status) {
      case 'not_drawn':
        return <Badge variant="outline">Chưa quay</Badge>;
      case 'drawn':
        return <Badge variant="secondary">Đã quay một phần</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Hoàn thành</Badge>;
      default:
        return null;
    }
  };

  const renderWinningNumberDisplay = (prize: PrizeWithDrawStatus) => {
    const slotCount = prize.prizesCount;
    const placeholder = '_'.repeat(prize.matchingDigits);
    const canDraw = prize.drawStatus !== 'completed';
    const isCurrentDrawing = isDrawing && currentDrawingPrizeId === prize.id;

    // Slots: placeholder or winning number badge (with redo icon inside)
    const slots = Array.from({ length: slotCount }, (_, index) => {
      const wn = prize.winningNumbers[index];
      if (wn) {
        const displayNumber = wn.number.padStart(prize.matchingDigits, '0');
        return (
          <span
            key={wn.id}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1 font-mono text-xl font-bold text-blue-900"
          >
            {displayNumber}
            <button
              type="button"
              onClick={() => onRedo(wn.id)}
              disabled={isDrawing}
              className="rounded p-0.5 hover:bg-blue-200 disabled:opacity-50"
              title="Quay lại"
              aria-label="Quay lại"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </span>
        );
      }
      return (
        <span
          key={`slot-${prize.id}-${index}`}
          className="font-mono text-2xl font-bold text-gray-400 px-3"
        >
          {placeholder}
        </span>
      );
    });

    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {isCurrentDrawing ? (
          <>
            {slots}
            <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/50">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </span>
          </>
        ) : (
          <>
            {slots}
            {canDraw && (
              <Button
                size="icon"
                variant="default"
                className="h-9 w-9 shrink-0"
                onClick={() => onDraw(prize.id)}
                disabled={isDrawing}
                title="Quay giải"
                aria-label="Quay giải"
              >
                <Play className="h-5 w-5" />
              </Button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody>
            {prizes.map((prize) => {
              const isExpanded = expandedRows.has(prize.id);
              const hasWinningNumbers = prize.winningNumbers.length > 0;

              return (
                <>
                  <tr key={prize.id} className="border-b hover:bg-muted/50">
                    <td className="w-56 px-4 py-3 w-1/2">
                      <div className="inline-flex items-center gap-2 font-medium">
                        {prize.title} <Badge variant="outline">{prize.prizesCount} Giải</Badge>
                        {hasWinningNumbers && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => toggleRow(prize.id)}
                            aria-label={isExpanded ? 'Thu gọn' : 'Xem người trúng'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {prize.prizeValue.toLocaleString('vi-VN')} VNĐ/Giải
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{renderWinningNumberDisplay(prize)}</td>
                  </tr>
                  {/* Expanded row showing winners */}
                  {isExpanded && hasWinningNumbers && (
                    <tr key={`${prize.id}-expanded`}>
                      <td colSpan={2} className="px-4 py-4 bg-muted/30">
                        <div className="space-y-3">
                          {prize.winningNumbers.map((wn) => (
                            <div key={wn.id} className="rounded-lg border bg-background p-4">
                              <div className="mb-2 font-semibold">
                                Số trúng: <span className="font-mono">{wn.number.padStart(prize.matchingDigits, '0')}</span>
                              </div>
                              {wn.winners && wn.winners.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-muted-foreground">
                                    Người trúng ({wn.winners.length}):
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {wn.winners.map((winner) => (
                                      <div
                                        key={winner.userId}
                                        className="rounded border p-2 text-sm"
                                      >
                                        <div className="font-medium">{winner.name}</div>
                                        <div className="text-muted-foreground">
                                          {winner.email}
                                        </div>
                                        <div className="mt-1 font-mono text-xs">
                                          Vé: {winner.ticketNumbers.join(', ')}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  Không có vé trúng giải
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
