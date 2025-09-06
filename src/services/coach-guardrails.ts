import { Chess } from 'chess.js';
import type { MistakeReviewOutput, MistakeReviewContext } from '@/types/coach';
import { CoachApiClient, parseAndValidateMistakeReview } from './coach-api';

export interface GuardrailsResult {
  output: MistakeReviewOutput;
  hadIllegalMoves: boolean;
  retryAttempted: boolean;
}

/**
 * Coach guardrails service for move validation and retry logic
 */
export class CoachGuardrails {
  private apiClient: CoachApiClient;

  constructor(apiClient: CoachApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Validate move legality and retry if illegal moves are suggested
   */
  async validateAndRetry(
    context: MistakeReviewContext,
    responseText: string
  ): Promise<GuardrailsResult> {
    let output: MistakeReviewOutput;
    
    try {
      output = parseAndValidateMistakeReview(responseText);
    } catch (error) {
      throw new Error(`Failed to parse initial response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check move legality
    const illegalMoves = this.findIllegalMoves(output.line, context.fen);
    
    if (illegalMoves.length === 0) {
      return {
        output,
        hadIllegalMoves: false,
        retryAttempted: false
      };
    }

    // Retry once with illegal move feedback
    console.warn('Illegal moves detected, retrying:', illegalMoves);
    
    try {
      const retryOutput = await this.retryWithFeedback(context, illegalMoves);
      return {
        output: retryOutput,
        hadIllegalMoves: true,
        retryAttempted: true
      };
    } catch (retryError) {
      // If retry fails, return fallback response
      console.error('Retry failed:', retryError);
      return {
        output: this.createFallbackResponse(context),
        hadIllegalMoves: true,
        retryAttempted: true
      };
    }
  }

  /**
   * Find illegal moves in the suggested line
   */
  private findIllegalMoves(moves: string[], fen: string): string[] {
    const illegalMoves: string[] = [];
    
    try {
      const chess = new Chess(fen);
      
      for (const move of moves) {
        try {
          // Try to make the move
          const result = chess.move(move);
          if (!result) {
            illegalMoves.push(move);
            break; // Stop checking further moves in invalid sequence
          }
        } catch (error) {
          illegalMoves.push(move);
          break;
        }
      }
    } catch (error) {
      console.error('Failed to validate moves due to invalid FEN:', error);
      // If FEN is invalid, consider all moves potentially problematic
      return moves;
    }

    return illegalMoves;
  }

  /**
   * Get all legal moves for the current position
   */
  private getLegalMoves(fen: string): string[] {
    try {
      const chess = new Chess(fen);
      return chess.moves({ verbose: false });
    } catch (error) {
      console.error('Failed to get legal moves:', error);
      return [];
    }
  }

  /**
   * Retry with feedback about illegal moves
   */
  private async retryWithFeedback(
    context: MistakeReviewContext,
    illegalMoves: string[]
  ): Promise<MistakeReviewOutput> {
    const legalMoves = this.getLegalMoves(context.fen);
    const legalMovesText = legalMoves.length > 0 
      ? legalMoves.slice(0, 20).join(', ') + (legalMoves.length > 20 ? '...' : '')
      : 'No legal moves available';

    // Create enhanced context with legal move constraint
    const enhancedContext = {
      ...context,
      retryFeedback: `You suggested illegal move(s): ${illegalMoves.join(', ')}. Only use these legal moves: ${legalMovesText}`
    };

    // Stream the retry request (simplified - just get the full response)
    const { stream, controller } = await this.apiClient.streamMistakeReview(context);
    
    try {
      let fullResponse = '';
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        fullResponse += this.extractContentFromChunk(chunk);
      }

      return parseAndValidateMistakeReview(fullResponse);
    } finally {
      controller.abort();
    }
  }

  /**
   * Extract content from SSE chunk
   */
  private extractContentFromChunk(chunk: string): string {
    const lines = chunk.split('\n');
    let content = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      
      const data = trimmed.substring(5).trim();
      if (data === '[DONE]') continue;
      
      try {
        const parsed = JSON.parse(data);
        const deltaContent = parsed?.choices?.[0]?.delta?.content;
        if (deltaContent) content += deltaContent;
      } catch (e) {
        // Skip malformed chunks
      }
    }
    
    return content;
  }

  /**
   * Create fallback response when retry fails
   */
  private createFallbackResponse(context: MistakeReviewContext): MistakeReviewOutput {
    const isBlunder = Math.abs(context.annotations.delta_cp) > 300;
    
    return {
      name: isBlunder ? 'Missed a critical opportunity' : 'Could have found a stronger move',
      why: "That move allowed your opponent to gain an advantage in the position.",
      better_plan: "Look for moves that maintain material balance and improve piece activity.",
      line: [] // Empty line since we can't guarantee legal moves
    };
  }
}