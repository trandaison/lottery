import { NextRequest, NextResponse } from 'next/server';
import { drawService } from '@/services/draw.service';
import type { ApiResponse } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/v1/admin/winning_numbers/[id]
 * Redo draw: Delete winning number and unmark associated tickets
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const winningNumberId = parseInt(id);

    if (isNaN(winningNumberId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: 'Invalid winning number ID',
          },
        },
        { status: 400 }
      );
    }

    // Redo draw (delete winning number and unmark tickets)
    await drawService.redoDraw(winningNumberId);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: 'Winning number deleted and tickets unmarked successfully' },
    });
  } catch (error) {
    console.error('Error redoing draw:', error);

    // Handle business logic errors
    if (error instanceof Error) {
      const errorCode = error.message.split(':')[0];
      const errorMessage = error.message.split(':')[1]?.trim() || error.message;

      if (
        errorCode === 'WINNING_NUMBER_NOT_FOUND' ||
        errorCode === 'PRIZE_NOT_FOUND'
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              code: errorCode,
              message: errorMessage,
            },
          },
          { status: 404 }
        );
      }
    }

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to redo draw',
        },
      },
      { status: 500 }
    );
  }
}
