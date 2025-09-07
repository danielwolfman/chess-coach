import type { MistakeReviewContext, MistakeReviewOutput } from '@/types/coach';

export interface ResponsesApiConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  voice?: string;
}

export interface CombinedResponse {
  text: MistakeReviewOutput;
  audioBlob: Blob;
}

export interface StreamedResponsesOutput {
  onChunk: (text: string) => void;
  onAudio: (audioChunk: Blob) => void;
  onComplete: (response: CombinedResponse) => void;
  onError: (error: Error) => void;
}

/**
 * OpenAI Responses API client for combined text + audio generation
 * Uses the new 2025 Responses API for unified streaming
 */
export class OpenAIResponsesAdapter {
  private config: ResponsesApiConfig;

  constructor(config: ResponsesApiConfig) {
    this.config = {
      baseUrl: 'https://api.openai.com/v1',
      voice: 'alloy',
      ...config
    };
  }

  /**
   * Stream combined text and audio response using OpenAI's Responses API
   */
  async streamCombinedResponse(
    context: MistakeReviewContext,
    callbacks: StreamedResponsesOutput
  ): Promise<AbortController> {
    const controller = new AbortController();

    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildMistakeReviewPrompt(context);

      const requestBody = {
        model: this.config.model,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        modalities: ['text', 'audio'],
        max_output_tokens: 1000,
        response_format: this.getStructuredOutputSchema(),
        voice: {
          model: 'gpt-4o-mini-tts',
          voice: this.config.voice,
          speed: 1.0,
          instructions: 'Speak as a friendly, encouraging chess coach with a warm and supportive tone.'
        }
      };

      console.log(`[${new Date().toLocaleTimeString()}] Starting Responses API request...`);

      const response = await fetch(`${this.config.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorMessage = `Responses API failed: ${response.status} ${response.statusText}`;
        try {
          const errorBody = await response.text();
          const errorData = JSON.parse(errorBody);
          if (errorData.error?.message) {
            errorMessage += ` - ${errorData.error.message}`;
          }
        } catch (e) {
          // Error parsing failed, use generic message
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('No response body received from Responses API');
      }

      // Process the streaming response
      await this.processStreamingResponse(response.body, callbacks, controller);

    } catch (error) {
      if (!controller.signal.aborted) {
        callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }

    return controller;
  }

  /**
   * Process the streaming response from the Responses API
   */
  private async processStreamingResponse(
    stream: ReadableStream<Uint8Array>,
    callbacks: StreamedResponsesOutput,
    controller: AbortController
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let textContent = '';
    let audioChunks: Blob[] = [];

    try {
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.substring(5).trim();
          if (data === '[DONE]') {
            // Complete response received
            if (textContent && audioChunks.length > 0) {
              try {
                const parsedText = this.parseTextResponse(textContent);
                const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
                callbacks.onComplete({ text: parsedText, audioBlob });
              } catch (error) {
                callbacks.onError(error instanceof Error ? error : new Error('Failed to parse final response'));
              }
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
            
            // Handle text modality
            if (parsed.choices?.[0]?.delta?.content) {
              const chunk = parsed.choices[0].delta.content;
              textContent += chunk;
              callbacks.onChunk(chunk);
            }

            // Handle audio modality
            if (parsed.choices?.[0]?.delta?.audio) {
              const audioData = parsed.choices[0].delta.audio;
              // Convert base64 audio data to Blob
              const binaryString = atob(audioData);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const audioChunk = new Blob([bytes], { type: 'audio/mpeg' });
              audioChunks.push(audioChunk);
              callbacks.onAudio(audioChunk);
            }

          } catch (e) {
            console.warn('Failed to parse streaming chunk:', data);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse the final text response and validate structure
   */
  private parseTextResponse(text: string): MistakeReviewOutput {
    try {
      // Extract JSON from the text
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
      throw new Error(`Failed to parse text response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get structured output schema for the JSON response
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

  /**
   * Check if the Responses API is available
   */
  isSupported(): boolean {
    return !!this.config.apiKey && typeof fetch !== 'undefined';
  }
}

/**
 * Create OpenAI Responses adapter if API key is available
 */
export function createOpenAIResponsesAdapter(): OpenAIResponsesAdapter | null {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return null;
  
  return new OpenAIResponsesAdapter({
    apiKey,
    model: 'gpt-4o', // Use gpt-4o for Responses API compatibility
    voice: 'alloy'
  });
}

/**
 * Get OpenAI API key from configuration
 */
function getOpenAIApiKey(): string | null {
  // Check localStorage first (user-provided key)
  if (typeof window !== 'undefined') {
    const userApiKey = localStorage.getItem('chess-coach-openai-api-key');
    if (userApiKey) return userApiKey;
  }

  // Check environment variable
  const envKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (envKey) return envKey;

  return null;
}