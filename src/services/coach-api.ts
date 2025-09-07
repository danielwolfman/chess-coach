import type { MistakeReviewContext, MistakeReviewOutput } from '@/types/coach';

export interface StreamResponse {
  stream: ReadableStream<Uint8Array>;
  controller: AbortController;
}

export interface CoachApiConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fallbackModels?: string[];
}

/**
 * Chess Coach API client with streaming support for GPT-5
 */
export class CoachApiClient {
  private config: CoachApiConfig;

  constructor(config: CoachApiConfig) {
    this.config = {
      baseUrl: 'https://api.openai.com/v1',
      fallbackModels: ['gpt-4o', 'gpt-4o-mini'],
      ...config
    };
  }

  /**
   * Stream a mistake review response from the LLM with fallback support
   */
  async streamMistakeReview(context: MistakeReviewContext): Promise<StreamResponse> {
    const modelsToTry = [this.config.model, ...(this.config.fallbackModels || [])];
    let lastError: Error | null = null;

    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      const controller = new AbortController();
      
      try {
        console.log(`Attempting API request with model: ${currentModel}${i > 0 ? ' (fallback)' : ''}`);
        
        const result = await this.attemptStreamRequest(context, currentModel, controller);
        
        if (i > 0) {
          console.log(`Successfully used fallback model: ${currentModel}`);
        }
        
        return result;
      } catch (error) {
        controller.abort();
        lastError = error as Error;
        
        // Check if this is a GPT-5 verification error
        const isVerificationError = this.isGPT5VerificationError(error as Error);
        
        if (isVerificationError && i < modelsToTry.length - 1) {
          console.log(`GPT-5 verification error detected, falling back to: ${modelsToTry[i + 1]}`);
          continue;
        }
        
        // If it's not a verification error or we're out of fallbacks, throw
        if (i === modelsToTry.length - 1) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('All models failed');
  }

  /**
   * Attempt to make a streaming request with a specific model
   */
  private async attemptStreamRequest(
    context: MistakeReviewContext, 
    model: string, 
    controller: AbortController
  ): Promise<StreamResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildMistakeReviewPrompt(context);

    const requestBody = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true,
      max_completion_tokens: 1000,
      response_format: this.getStructuredOutputSchema()
    };

    console.log('Making API request with:', { 
      url: `${this.config.baseUrl}/chat/completions`,
      model: model,
      messageCount: requestBody.messages.length,
      hasApiKey: !!this.config.apiKey
    });

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        const errorBody = await response.text();
        console.error('API Error Response:', errorBody);
        const errorData = JSON.parse(errorBody);
        if (errorData.error?.message) {
          errorMessage += ` - ${errorData.error.message}`;
        }
        // Store the full error for verification checking
        const error = new Error(errorMessage);
        (error as any).apiResponse = errorData;
        throw error;
      } catch (parseError) {
        console.error('Could not parse error response');
        throw new Error(errorMessage);
      }
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    return {
      stream: response.body,
      controller
    };
  }

  /**
   * Check if the error is specifically the GPT-5 organization verification error
   */
  private isGPT5VerificationError(error: Error): boolean {
    const apiResponse = (error as any).apiResponse;
    if (!apiResponse?.error) return false;
    
    const errorCode = apiResponse.error.code;
    const errorType = apiResponse.error.type;
    const errorMessage = apiResponse.error.message;
    const param = apiResponse.error.param;
    
    return (
      errorCode === 'unsupported_value' &&
      errorType === 'invalid_request_error' &&
      param === 'stream' &&
      errorMessage?.includes('organization must be verified')
    );
  }

  /**
   * Build system prompt for the chess coach
   */
  private buildSystemPrompt(): string {
    return `You are a friendly, encouraging chess coach who speaks naturally to players. Avoid technical jargon like "centipawns" or overly analytical language. Your goal is to help players improve through clear, human explanations.

When analyzing a mistake:
- Give it a descriptive name that explains what went wrong (e.g., "Missed a tactical opportunity" or "Overlooked opponent's threat")
- Explain in conversational language why the move created problems
- Suggest a better approach or mindset for similar positions
- Provide a concrete alternative line of play (up to 6 moves in algebraic notation)

Speak as if you're sitting next to the player, using encouraging language. Focus on learning opportunities rather than dwelling on the error. Never suggest illegal moves.

Respond with a JSON object in this exact format:
{
  "name": "Friendly description of what went wrong",
  "why": "Conversational explanation of why this created problems",
  "better_plan": "Encouraging description of the right approach",
  "line": ["move1", "move2", "move3"]
}`;
  }

  /**
   * Get structured output schema for better JSON reliability
   */
  private getStructuredOutputSchema() {
    return {
      type: 'json_schema',
      json_schema: {
        name: 'mistake_review',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Friendly description of what went wrong'
            },
            why: {
              type: 'string',
              description: 'Conversational explanation of why this created problems'
            },
            better_plan: {
              type: 'string',
              description: 'Encouraging description of the right approach'
            },
            line: {
              type: 'array',
              items: { type: 'string' },
              description: 'Alternative line of play in algebraic notation'
            }
          },
          required: ['name', 'why', 'better_plan', 'line'],
          additionalProperties: false
        }
      }
    };
  }

  /**
   * Build user prompt for mistake review
   */
  private buildMistakeReviewPrompt(context: MistakeReviewContext): string {
    const { playerColor, level, fen, lastMovesSan, annotations } = context;
    
    return `Position: ${fen}
Player: ${playerColor} (Level ${level})
Recent moves: ${lastMovesSan.slice(-8).join(' ')}

The player just made a move that wasn't the strongest choice. The computer analysis shows this move worsened their position.

${annotations.best_line?.length ? `A better line would have been: ${annotations.best_line.join(' ')}` : ''}
${annotations.motifs?.length ? `Key tactical themes in this position: ${annotations.motifs.join(', ')}` : ''}

Please help the player understand what went wrong with their move and suggest a better approach. Be encouraging and focus on learning. Remember: only suggest moves that are legal in this position.`;
  }
}

/**
 * Parse streamed JSON response from the LLM
 */
export async function* parseStreamedResponse(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        
        const data = trimmed.substring(5).trim(); // Remove 'data:' prefix
        if (data === '[DONE]') return;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed?.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (e) {
          // Skip malformed JSON
          console.warn('Failed to parse streaming chunk:', data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Validate and parse the final JSON response
 */
export function parseAndValidateMistakeReview(text: string): MistakeReviewOutput {
  try {
    // Extract JSON from the text (in case there's extra content)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;
    
    const parsed = JSON.parse(jsonText);
    
    // Validate required fields
    if (!parsed.name || typeof parsed.name !== 'string') {
      throw new Error('Missing or invalid "name" field');
    }
    if (!parsed.why || typeof parsed.why !== 'string') {
      throw new Error('Missing or invalid "why" field');
    }
    if (!parsed.better_plan || typeof parsed.better_plan !== 'string') {
      throw new Error('Missing or invalid "better_plan" field');
    }
    if (!Array.isArray(parsed.line)) {
      throw new Error('Missing or invalid "line" field');
    }

    return {
      name: parsed.name,
      why: parsed.why,
      better_plan: parsed.better_plan,
      line: parsed.line
    };
  } catch (error) {
    throw new Error(`Failed to parse mistake review response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify that suggested moves are legal in the given position
 */
export function validateMoveLegality(moves: string[], fen: string): { legal: string[], illegal: string[] } {
  // TODO: Implement chess legality check using chess.js
  // For now, return all moves as legal (will be implemented in guardrails)
  return {
    legal: moves,
    illegal: []
  };
}
