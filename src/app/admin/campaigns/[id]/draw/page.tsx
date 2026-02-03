'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DrawWheelGroup } from '@/components/admin/DrawWheelGroup';
import { ResultsTable } from '@/components/admin/ResultsTable';
import { WinnerPopup } from '@/components/admin/WinnerPopup';
import { useAuth } from '@/lib/context/AuthContext';
import type { PrizeWithDrawStatus, DrawResponse } from '@/types';
import { ArrowLeft, LogOut, AlertTriangle } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface PrizesResponse {
  campaign: {
    id: number;
    uuid: string;
    title: string;
    excludeWinningNumbers: boolean;
    status?: 'active' | 'drawing' | 'completed' | 'canceled';
    prizeValueType?: 'fixed' | 'percent';
  };
  prizes: PrizeWithDrawStatus[];
  totalRevenue: number;
}

export default function DrawCampaignPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { logout } = useAuth();
  const campaignId = parseInt(resolvedParams.id);

  // State
  const [campaign, setCampaign] = useState<PrizesResponse['campaign'] | null>(null);
  const [prizes, setPrizes] = useState<PrizeWithDrawStatus[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draftMode, setDraftMode] = useState(false);
  const [shuffledNumbers, setShuffledNumbers] = useState<string[] | null>(null);
  const [isSubmittingDraw, setIsSubmittingDraw] = useState(false);
  const [currentMatchingDigits, setCurrentMatchingDigits] = useState(6);
  const [currentDrawingPrizeId, setCurrentDrawingPrizeId] = useState<number | null>(null);
  const [drawResult, setDrawResult] = useState<DrawResponse | null>(null);
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showRedoDialog, setShowRedoDialog] = useState(false);
  const [redoWinningNumberId, setRedoWinningNumberId] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAlreadyWonDialog, setShowAlreadyWonDialog] = useState(false);
  const [alreadyWonNumber, setAlreadyWonNumber] = useState<string | null>(null);
  const [alreadyWonPrizeTitle, setAlreadyWonPrizeTitle] = useState<string | null>(null);

  const SOUND_STORAGE_KEY = 'lottery-draw-sound';
  const getStoredSound = useCallback(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(SOUND_STORAGE_KEY);
      return v !== 'false';
    } catch {
      return true;
    }
  }, []);
  const [soundEnabled, setSoundEnabled] = useState(true);
  useEffect(() => {
    setSoundEnabled(getStoredSound());
  }, [getStoredSound]);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  // Preload background music when visiting the page to avoid delay on first play
  useEffect(() => {
    const audio = new Audio('/assets/sounds/bg_sound.mp3');
    audio.preload = 'auto';
    audio.load();
    bgAudioRef.current = audio;
    return () => {
      audio.pause();
      bgAudioRef.current = null;
    };
  }, []);

  const handleSoundChange = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
      const audio = bgAudioRef.current;
      if (audio) audio.volume = enabled ? 1 : 0;
    } catch {
      // ignore
    }
  }, []);

  const playBgSound = useCallback(() => {
    try {
      const audio = bgAudioRef.current;
      if (audio) {
        audio.loop = true;
        audio.volume = soundEnabled ? 1 : 0;
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  const stopBgSound = useCallback(() => {
    try {
      if (bgAudioRef.current) {
        bgAudioRef.current.pause();
        bgAudioRef.current.currentTime = 0;
      }
    } catch {
      // ignore
    }
  }, []);

  const playSuccessSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio('/assets/sounds/success.wav');
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // Fetch prizes data
  const fetchPrizes = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/admin/campaigns/${campaignId}/prizes`);
      const result = await response.json();

      if (result.success) {
        setCampaign(result.data.campaign);
        setPrizes(result.data.prizes);
        setTotalRevenue(result.data.totalRevenue ?? 0);
      } else {
        toast.error('Failed to load prizes');
        router.push('/admin/campaigns');
      }
    } catch (error) {
      console.error('Error fetching prizes:', error);
      toast.error('Failed to load prizes');
      router.push('/admin/campaigns');
    } finally {
      setLoading(false);
    }
  }, [campaignId, router]);

  useEffect(() => {
    fetchPrizes();
  }, [fetchPrizes]);

  /** Winning number strings (pad to 6 chars) for excludeWinningNumbers logic. */
  const winningNumberSuffixes = useMemo(() => {
    const list: string[] = [];
    for (const prize of prizes) {
      for (const wn of prize.winningNumbers) {
        if (wn.number != null && wn.number !== '') {
          list.push(wn.number.padStart(6, '0').slice(-6));
        }
      }
    }
    return list;
  }, [prizes]);

  // Check campaign status and draw conditions
  const campaignStatus = campaign?.status;
  const canStartDraw =
    campaignStatus === 'active' && prizes.some((p) => p.drawStatus === 'not_drawn');
  const allPrizesCompleted =
    prizes.length > 0 && prizes.every((p) => p.drawStatus === 'completed');
  const canCompleteDraw = allPrizesCompleted;

  // Handle start draw
  const handleStartDraw = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/v1/admin/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'drawing' }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Đã bắt đầu quay số');
        await fetchPrizes(); // Refresh data
        setShowStartDialog(false);
      } else {
        toast.error(result.error?.message || 'Failed to start draw');
      }
    } catch (error) {
      console.error('Error starting draw:', error);
      toast.error('Failed to start draw');
    } finally {
      setIsUpdating(false);
    }
  };

  // Fisher–Yates shuffle
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };

  // Load candidates for a prize, shuffle on client, show DrawWheel
  const handleDraw = async (prizeId: number) => {
    const prize = prizes.find((p) => p.id === prizeId);
    if (!prize) return;

    if (prize.drawStatus === 'completed') {
      toast.error('Giải này đã hoàn thành');
      return;
    }

    setCurrentDrawingPrizeId(prizeId);
    setCurrentMatchingDigits(prize.matchingDigits);
    setShuffledNumbers(null);

    try {
      const response = await fetch(
        `/api/v1/admin/campaigns/${campaignId}/draw/candidates?prizeId=${prizeId}`
      );
      const result = await response.json();

      if (result.success && Array.isArray(result.data?.numbers)) {
        const numbers = shuffle(result.data.numbers as string[]);
        setShuffledNumbers(numbers);
      } else {
        toast.error(result.error?.message || 'Không thể tải danh sách số');
        setCurrentDrawingPrizeId(null);
      }
    } catch (error) {
      console.error('Error loading candidates:', error);
      toast.error('Không thể tải danh sách số');
      setCurrentDrawingPrizeId(null);
    }
  };

  // When all wheels stop: if excludeWinningNumbers, check if number already won; then submit or show "đã trúng giải trước"
  const handleWheelStop = async (winningNumber: string) => {
    if (currentDrawingPrizeId == null) return;

    // Pad to matchingDigits để khớp với candidate list server (RIGHT(ticket_number, N) trả về có leading zero)
    const winningNumberPadded = winningNumber.padStart(currentMatchingDigits, '0');
    const number6 = winningNumber.padStart(6, '0').slice(-6);

    setIsSubmittingDraw(true);
    try {
      if (campaign?.excludeWinningNumbers) {
        const checkRes = await fetch(
          `/api/v1/admin/campaigns/${campaignId}/draw/check-winning?number=${encodeURIComponent(number6)}`
        );
        const checkResult = await checkRes.json();
        if (checkResult.success && checkResult.data?.alreadyWon && checkResult.data.prize) {
          stopBgSound();
          setAlreadyWonNumber(number6);
          setAlreadyWonPrizeTitle(checkResult.data.prize.title);
          setShowAlreadyWonDialog(true);
          return;
        }
      }

      // Submit số đã pad đủ matchingDigits để server so sánh đúng với candidate list (RIGHT() giữ leading zero)
      const response = await fetch(`/api/v1/admin/campaigns/${campaignId}/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prizeId: currentDrawingPrizeId,
          draftMode,
          winningNumber: winningNumberPadded,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setDrawResult(result.data as DrawResponse);
        if (!draftMode) await fetchPrizes();
        setTimeout(() => {
          stopBgSound();
          playSuccessSound();
          setShowWinnerPopup(true);
        }, 750);
      } else {
        toast.error(result.error?.message || 'Xác nhận kết quả thất bại');
      }
    } catch (error) {
      console.error('Error confirming draw:', error);
      toast.error('Xác nhận kết quả thất bại');
    } finally {
      setIsSubmittingDraw(false);
    }
  };

  // Handle redo draw
  const handleRedo = (winningNumberId: number) => {
    setRedoWinningNumberId(winningNumberId);
    setShowRedoDialog(true);
  };

  const confirmRedo = async () => {
    if (!redoWinningNumberId) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/v1/admin/winning_numbers/${redoWinningNumberId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Đã xóa kết quả quay số');
        await fetchPrizes(); // Refresh data
        setShowRedoDialog(false);
        setRedoWinningNumberId(null);
      } else {
        toast.error(result.error?.message || 'Failed to redo draw');
      }
    } catch (error) {
      console.error('Error redoing draw:', error);
      toast.error('Failed to redo draw');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle complete draw (chốt kết quả): gọi API complete để chuyển campaign sang completed và hủy đơn chờ
  const handleCompleteDraw = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/v1/admin/campaigns/${campaignId}/complete`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        const failedOrdersCount = result.data?.failedOrdersCount ?? 0;
        if (failedOrdersCount > 0) {
          toast.success(
            `Campaign đã hoàn thành. ${failedOrdersCount} đơn hàng đang chờ thanh toán đã bị hủy.`
          );
        } else {
          toast.success('Campaign đã hoàn thành');
        }
        router.push('/admin/campaigns');
      } else {
        toast.error(result.error?.message || 'Chốt kết quả thất bại');
      }
    } catch (error) {
      console.error('Error completing campaign:', error);
      toast.error('Chốt kết quả thất bại');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Campaign not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Full-Screen Header */}
      <div className="border-b bg-card">
        <div className="w-full flex h-16 items-center justify-between px-6">
          {/* Left: Back button + Campaign title */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/admin/campaigns')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">{campaign.title}</h1>
          </div>

          {/* Right: Action buttons + Logout */}
          <div className="flex items-center gap-2">
            {canStartDraw && (
              <Button onClick={() => setShowStartDialog(true)} disabled={!!shuffledNumbers}>
                Bắt đầu quay số
              </Button>
            )}
            {canCompleteDraw && (
              <Button onClick={() => setShowCompleteDialog(true)} variant="default">
                Hoàn thành quay số
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content: 2-column grid */}
      <div className="w-full px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left: Draw Wheel (shuffled numbers, Quay số / Dừng) */}
          <div className="flex flex-col items-center justify-center">
            <h2 className="mb-4 text-2xl font-bold">
              {currentDrawingPrizeId != null
                ? (() => {
                    const prize = prizes.find((p) => p.id === currentDrawingPrizeId);
                    return prize ? `Đang quay: ${prize.title}` : 'Chọn giải để quay';
                  })()
                : 'Chọn giải để quay'}
            </h2>
            <DrawWheelGroup
              key={currentDrawingPrizeId ?? 'no-prize'}
              numbers={shuffledNumbers ?? ['000000']}
              matchingDigits={currentMatchingDigits}
              excludeWinningNumbers={campaign?.excludeWinningNumbers ?? false}
              winningNumberSuffixes={winningNumberSuffixes}
              onComplete={handleWheelStop}
              disabled={isSubmittingDraw}
              soundEnabled={soundEnabled}
              onSoundChange={handleSoundChange}
              onSpinStart={playBgSound}
              draftMode={draftMode}
              onDraftModeChange={setDraftMode}
            />
          </div>

          {/* Right: Results Table */}
          <div>
            <h2 className="mb-4 text-2xl font-bold">Kết quả quay số</h2>
            <ResultsTable
              prizes={prizes}
              totalRevenue={totalRevenue}
              prizeValueType={campaign?.prizeValueType ?? 'fixed'}
              onDraw={handleDraw}
              onRedo={handleRedo}
              isDrawing={!!shuffledNumbers}
              currentDrawingPrizeId={currentDrawingPrizeId}
            />
          </div>
        </div>
      </div>

      {/* Winner Popup */}
      <WinnerPopup
        open={showWinnerPopup}
        onClose={() => {
          setShowWinnerPopup(false);
          setShuffledNumbers(null);
          setCurrentDrawingPrizeId(null);
        }}
        onContinue={() => {
          setShowWinnerPopup(false);
          setShuffledNumbers(null);
          setCurrentDrawingPrizeId(null);
        }}
        drawResult={drawResult}
        matchingDigits={currentMatchingDigits}
      />

      {/* Start Draw Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bắt đầu quay số</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn bắt đầu quay số cho campaign này? Sau khi bắt đầu, campaign sẽ
              chuyển sang trạng thái "drawing" và không thể mua vé nữa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStartDialog(false)}
              disabled={isUpdating}
            >
              Hủy
            </Button>
            <Button onClick={handleStartDraw} disabled={isUpdating}>
              {isUpdating ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Draw Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hoàn thành quay số</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn hoàn thành quay số? Sau khi hoàn thành:
              <br />
              <br />
              • Campaign sẽ chuyển sang trạng thái "completed"
              <br />
              • Tất cả các đơn hàng đang chờ thanh toán sẽ bị hủy
              <br />
              • Không thể quay lại hoặc thay đổi kết quả
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCompleteDialog(false)}
              disabled={isUpdating}
            >
              Hủy
            </Button>
            <Button onClick={handleCompleteDraw} disabled={isUpdating} variant="destructive">
              {isUpdating ? 'Đang xử lý...' : 'Xác nhận hoàn thành'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redo Dialog */}
      <Dialog open={showRedoDialog} onOpenChange={setShowRedoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa kết quả quay số</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa kết quả quay số này? Kết quả hiện tại sẽ bị xóa và các vé
              trúng giải sẽ được đánh dấu lại là không trúng.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRedoDialog(false);
                setRedoWinningNumberId(null);
              }}
              disabled={isUpdating}
            >
              Hủy
            </Button>
            <Button onClick={confirmRedo} disabled={isUpdating} variant="destructive">
              {isUpdating ? 'Đang xử lý...' : 'Xác nhận xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Already won (excludeWinningNumbers): số đã trúng giải trước, quay lại */}
      <Dialog open={showAlreadyWonDialog} onOpenChange={setShowAlreadyWonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Số đã trúng giải trước</DialogTitle>
            <DialogDescription>
              Số vé <span className="font-mono font-semibold">{alreadyWonNumber ?? '—'}</span> đã
              trúng giải <span className="font-semibold">{alreadyWonPrizeTitle ?? '—'}</span>. Vui
              lòng quay số lại để chọn số khác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowAlreadyWonDialog(false);
                setAlreadyWonNumber(null);
                setAlreadyWonPrizeTitle(null);
              }}
            >
              Đóng (quay số lại)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
