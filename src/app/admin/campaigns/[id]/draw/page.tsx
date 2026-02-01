'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollingMeter } from '@/components/admin/ScrollingMeter';
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
  };
  prizes: PrizeWithDrawStatus[];
}

export default function DrawCampaignPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { logout } = useAuth();
  const campaignId = parseInt(resolvedParams.id);

  // State
  const [campaign, setCampaign] = useState<PrizesResponse['campaign'] | null>(null);
  const [prizes, setPrizes] = useState<PrizeWithDrawStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftMode, setDraftMode] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [targetNumber, setTargetNumber] = useState<string | null>(null);
  const [currentMatchingDigits, setCurrentMatchingDigits] = useState(6);
  const [currentDrawingPrizeId, setCurrentDrawingPrizeId] = useState<number | null>(null);
  const [drawResult, setDrawResult] = useState<DrawResponse | null>(null);
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showRedoDialog, setShowRedoDialog] = useState(false);
  const [redoWinningNumberId, setRedoWinningNumberId] = useState<number | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch prizes data
  const fetchPrizes = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/admin/campaigns/${campaignId}/prizes`);
      const result = await response.json();

      if (result.success) {
        setCampaign(result.data.campaign);
        setPrizes(result.data.prizes);
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

  // Check campaign status and draw conditions
  const campaignStatus = campaign?.status;
  const canStartDraw =
    campaignStatus === 'active' && prizes.some((p) => p.drawStatus === 'not_drawn');
  const allPrizesCompleted =
    prizes.length > 0 && prizes.every((p) => p.drawStatus === 'completed');
  const canCompleteDraw = campaignStatus === 'drawing' && allPrizesCompleted;

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

  // Handle draw prize
  const handleDraw = async (prizeId: number) => {
    const prize = prizes.find((p) => p.id === prizeId);
    if (!prize) return;

    // Check if prize is already completed
    if (prize.drawStatus === 'completed') {
      toast.error('Giải này đã hoàn thành');
      return;
    }

    // Start animation
    setIsAnimating(true);
    setCurrentDrawingPrizeId(prizeId);
    setCurrentMatchingDigits(prize.matchingDigits);
    setTargetNumber(null);

    try {
      // Call API to get winning number (query-first)
      const response = await fetch(`/api/v1/admin/campaigns/${campaignId}/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prizeId,
          draftMode,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const drawData: DrawResponse = result.data;
        setDrawResult(drawData);
        setTargetNumber(drawData.winningNumber);

        // If not draft mode, refresh prizes to show updated status
        if (!draftMode) {
          await fetchPrizes();
        }
      } else {
        toast.error(result.error?.message || 'Failed to draw winning number');
        setIsAnimating(false);
        setCurrentDrawingPrizeId(null);
      }
    } catch (error) {
      console.error('Error drawing:', error);
      toast.error('Failed to draw winning number');
      setIsAnimating(false);
      setCurrentDrawingPrizeId(null);
    }
  };

  // Handle animation complete
  const handleAnimationComplete = () => {
    setIsAnimating(false);
    setShowWinnerPopup(true);
  };

  // Handle stop animation (manual stop)
  const handleStopAnimation = () => {
    if (targetNumber) {
      // Force complete animation
      setIsAnimating(false);
      setShowWinnerPopup(true);
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

  // Handle complete draw
  const handleCompleteDraw = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/v1/admin/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      const result = await response.json();

      if (result.success) {
        const failedOrdersCount = result.data?.failedOrdersCount || 0;
        if (failedOrdersCount > 0) {
          toast.success(
            `Campaign đã hoàn thành. ${failedOrdersCount} đơn hàng đang chờ thanh toán đã bị hủy.`
          );
        } else {
          toast.success('Campaign đã hoàn thành');
        }
        router.push('/admin/campaigns');
      } else {
        toast.error(result.error?.message || 'Failed to complete campaign');
      }
    } catch (error) {
      console.error('Error completing campaign:', error);
      toast.error('Failed to complete campaign');
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

          {/* Center: Draft mode toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="draft-mode"
                checked={draftMode}
                onCheckedChange={setDraftMode}
                disabled={isAnimating}
              />
              <Label htmlFor="draft-mode" className="cursor-pointer">
                Chế độ thử nghiệm
              </Label>
            </div>
            {draftMode && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Kết quả không được lưu
              </Badge>
            )}
          </div>

          {/* Right: Action buttons + Logout */}
          <div className="flex items-center gap-2">
            {canStartDraw && (
              <Button onClick={() => setShowStartDialog(true)} disabled={isAnimating}>
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
          {/* Left: Scrolling Meter */}
          <div className="flex flex-col items-center justify-center">
            <div className="mb-4 text-center">
              <h2 className="mb-2 text-2xl font-bold">Máy quay số</h2>
              {isAnimating && (
                <Button
                  onClick={handleStopAnimation}
                  variant="destructive"
                  size="lg"
                  className="mt-4"
                >
                  Dừng
                </Button>
              )}
            </div>
            <ScrollingMeter
              targetNumber={targetNumber}
              matchingDigits={currentMatchingDigits}
              isAnimating={isAnimating}
              onAnimationComplete={handleAnimationComplete}
            />
          </div>

          {/* Right: Results Table */}
          <div>
            <h2 className="mb-4 text-2xl font-bold">Kết quả quay số</h2>
            <ResultsTable
              prizes={prizes}
              onDraw={handleDraw}
              onRedo={handleRedo}
              isDrawing={isAnimating}
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
          setTargetNumber(null);
          setCurrentDrawingPrizeId(null);
        }}
        onContinue={() => {
          setShowWinnerPopup(false);
          setTargetNumber(null);
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
    </div>
  );
}
