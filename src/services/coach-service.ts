import { CoachApiClient, parseStreamedResponse } from './coach-api';
import { CoachGuardrails } from './coach-guardrails';
import { packMistakeReviewContext } from './coach-context';
import { performDeepAnalysis } from './deep-analysis';
import type { GameState } from '@/rules/chess';
import type { PlyAnnotation } from '@/types/annotations';
import type { MistakeReviewOutput } from '@/types/coach';

export interface CoachConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface StreamedMistakeExplanation {
  onChunk: (text: string) => void;
  onComplete: (output: MistakeReviewOutput) => void;
  onError: (error: Error) => void;
  controller: AbortController;
}

/**
 * High-level coach service that orchestrates LLM, engine, and guardrails
 */
export class CoachService {
  private apiClient: CoachApiClient;
  private guardrails: CoachGuardrails;

  constructor(config: CoachConfig) {
    this.apiClient = new CoachApiClient({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl
    });
    this.guardrails = new CoachGuardrails(this.apiClient);
  }

  /**
   * Stream a mistake explanation with deep analysis
   */
  async streamMistakeExplanation(
    gameState: GameState,
    annotations: Record<string, PlyAnnotation>,
    moveIndex: number,
    level: number,
    callbacks: Pick<StreamedMistakeExplanation, 'onChunk' | 'onComplete' | 'onError'>
  ): Promise<AbortController> {
    const controller = new AbortController();

    try {
      // Get the move annotation
      const annotation = annotations[String(moveIndex)];
      if (!annotation) {
        throw new Error();
      }

      // Perform deep engine analysis for enriched context
      let deepAnalysis: any;
      try {
        // Reconstruct FEN before the mistake move
        const fenBefore = this.getFenBeforeMove(gameState, moveIndex);
        deepAnalysis = await performDeepAnalysis(
          fenBefore,
          annotation.fen,
          annotation.uci,
          level,
          { depth: Math.min(14, 10 + Math.floor(level / 4)) }
        );
      } catch (error) {
        console.warn('Deep analysis failed, using basic context:', error);
        deepAnalysis = null;
      }

      // Pack context for LLM
      const context = packMistakeReviewContext(gameState, annotations, moveIndex, level);
      
      // Enhance context with deep analysis if available
      if (deepAnalysis) {
        context.annotations.best_line = deepAnalysis.bestLine.slice(0, 6);
        context.annotations.refutation_line = deepAnalysis.refutationLine.slice(0, 6);
        context.annotations.motifs = deepAnalysis.motifs;
      }

      // Start streaming from LLM
      const { stream, controller: streamController } = await this.apiClient.streamMistakeReview(context);
      
      // Forward abort signal
      controller.signal.addEventListener('abort', () => {
        streamController.abort();
      });

      let fullText = '';
      
      // Process stream
      for await (const chunk of parseStreamedResponse(stream)) {
        if (controller.signal.aborted) break;
        
        fullText += chunk;
        callbacks.onChunk(chunk);
      }

      if (!controller.signal.aborted) {
        // Validate and parse final response with guardrails
        try {
          const result = await this.guardrails.validateAndRetry(context, fullText);
          callbacks.onComplete(result.output);
        } catch (error) {
          throw new Error();
        }
      }

    } catch (error) {
      if (!controller.signal.aborted) {
        callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }

    return controller;
  }

  /**
   * Get FEN position before a specific move (simplified reconstruction)
   */
  private getFenBeforeMove(gameState: GameState, _moveIndex: number): string {
    // This is a simplified implementation
    // In a complete implementation, you'd reconstruct the exact position
    // For now, we'll use the current FEN as approximation
    return gameState.fen;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return this.apiClient !== null;
  }
}

/**
 * Create coach service from environment/settings
 */
export function createCoachService(): CoachService | null {
  // In a real implementation, you'd get the API key from:
  // 1. Environment variables
  // 2. User settings/preferences 
  // 3. Secure storage
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('No API key configured for coach service');
    return null;
  }

  return new CoachService({
    apiKey,
    model: 'gpt-5', // Main GPT-5 model as shown in working example
    baseUrl: 'https://api.openai.com/v1'
  });
}

/**
 * Get API key from configuration
 * This is a placeholder - implement based on your app's config system
 */
function getApiKey(): string | null {
  // Priority order:
  // 1) User settings (localStorage / sessionStorage)
  // 2) Vite env var (VITE_OPENAI_API_KEY)
  // 3) Node env (OPENAI_API_KEY) - useful in dev/preview
  
  // Guard localStorage access (can throw in some browsers/modes)
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('chess-coach-openai-api-key');
      const userApiKey = raw?.trim();
      if (userApiKey) return userApiKey;

      // Fallback: sometimes wizards stash temporarily in sessionStorage
      const sessionKey = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('chess-coach-openai-api-key') : null;
      const sessionApiKey = sessionKey?.trim();
      if (sessionApiKey) return sessionApiKey;
    }
  } catch (e) {
    // Non-fatal; continue to env fallbacks
    console.warn('Could not access web storage for API key:', e);
  }

  // Vite env var
  const envKey = (import.meta as any)?.env?.VITE_OPENAI_API_KEY as string | undefined;
  if (envKey && String(envKey).trim()) return String(envKey).trim();

  // Node env (useful during local dev / tests)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeKey = (globalThis as any)?.process?.env?.OPENAI_API_KEY;
    if (nodeKey && String(nodeKey).trim()) return String(nodeKey).trim();
  } catch {}

  return null;
}
