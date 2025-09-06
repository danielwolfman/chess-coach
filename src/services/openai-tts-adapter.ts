import type { TTSAdapter, TTSSession } from './tts-adapter';

/**
 * OpenAI TTS API implementation
 * Uses OpenAI's high-quality text-to-speech API
 */
export class OpenAITTSAdapter implements TTSAdapter {
  private apiKey: string;
  private baseUrl: string;
  private enabled = true;
  private voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy';
  private speed = 1.0;
  private activeSessions = new Map<string, OpenAITTSSession>();

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.loadSettings();
  }

  begin(requestId: string): TTSSession {
    // Stop any existing session
    const existingSession = this.activeSessions.get(requestId);
    if (existingSession) {
      existingSession.stop('new_session');
    }

    const session = new OpenAITTSSession(
      requestId,
      this.apiKey,
      this.baseUrl,
      this.enabled,
      this.voice,
      this.speed,
      () => this.activeSessions.delete(requestId)
    );

    this.activeSessions.set(requestId, session);
    return session;
  }

  setVoice(voiceId: string): void {
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (validVoices.includes(voiceId)) {
      this.voice = voiceId as typeof this.voice;
      this.saveSettings();
    }
  }

  setRate(rate: number): void {
    // OpenAI supports 0.25 to 4.0 speed
    this.speed = Math.max(0.25, Math.min(4.0, rate));
    this.saveSettings();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // Stop all active sessions
      for (const session of this.activeSessions.values()) {
        session.stop('disabled');
      }
    }
    this.saveSettings();
  }

  getVoices(): any[] {
    return [
      { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice' },
      { id: 'echo', name: 'Echo', description: 'Clear, articulate voice' },
      { id: 'fable', name: 'Fable', description: 'Warm, storytelling voice' },
      { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative voice' },
      { id: 'nova', name: 'Nova', description: 'Bright, energetic voice' },
      { id: 'shimmer', name: 'Shimmer', description: 'Soft, gentle voice' }
    ];
  }

  isSupported(): boolean {
    return !!this.apiKey && typeof fetch !== 'undefined';
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('chess-coach-openai-tts-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.enabled = settings.enabled ?? true;
        this.voice = settings.voice ?? 'alloy';
        this.speed = settings.speed ?? 1.0;
      }
    } catch (e) {
      console.warn('Failed to load OpenAI TTS settings:', e);
    }
  }

  private saveSettings(): void {
    try {
      const settings = {
        enabled: this.enabled,
        voice: this.voice,
        speed: this.speed
      };
      localStorage.setItem('chess-coach-openai-tts-settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save OpenAI TTS settings:', e);
    }
  }
}

/**
 * OpenAI TTS session implementation with sentence-buffered streaming
 */
class OpenAITTSSession implements TTSSession {
  private requestId: string;
  private apiKey: string;
  private baseUrl: string;
  private enabled: boolean;
  private voice: string;
  private speed: number;
  private onCleanup: () => void;
  
  private textBuffer = '';
  private audioQueue: HTMLAudioElement[] = [];
  private isPlaying = false;
  private stopped = false;
  private currentAudio: HTMLAudioElement | null = null;
  
  // Sentence boundary regex - more sophisticated than Web Speech version
  private static SENTENCE_REGEX = /([.!?]+\s+|[.!?]+$)/g;

  constructor(
    requestId: string,
    apiKey: string,
    baseUrl: string,
    enabled: boolean,
    voice: string,
    speed: number,
    onCleanup: () => void
  ) {
    this.requestId = requestId;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.enabled = enabled;
    this.voice = voice;
    this.speed = speed;
    this.onCleanup = onCleanup;
  }

  feed(textChunk: string): void {
    if (!this.enabled || this.stopped) return;

    this.textBuffer += textChunk;
    this.processBuffer(); // Fire and forget - don't await to keep interface compatible
  }

  stop(reason = 'user_requested'): void {
    if (this.stopped) return;
    
    this.stopped = true;
    this.textBuffer = '';
    
    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
    
    // Clear queue
    this.audioQueue.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.audioQueue = [];
    this.isPlaying = false;
    
    console.log(`OpenAI TTS session ${this.requestId} stopped: ${reason}`);
    this.onCleanup();
  }

  isActive(): boolean {
    return !this.stopped && (this.isPlaying || this.audioQueue.length > 0);
  }

  /**
   * Process text buffer and extract complete sentences
   */
  private async processBuffer(): Promise<void> {
    const sentences = this.extractSentences(this.textBuffer);
    
    for (const sentence of sentences) {
      const cleaned = sentence.trim();
      if (cleaned && cleaned.length > 3) { // Skip very short fragments
        await this.generateAudio(cleaned);
      }
    }
    
    this.processQueue();
  }

  /**
   * Extract complete sentences from buffer
   */
  private extractSentences(text: string): string[] {
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    OpenAITTSSession.SENTENCE_REGEX.lastIndex = 0;
    
    while ((match = OpenAITTSSession.SENTENCE_REGEX.exec(text)) !== null) {
      const sentence = text.substring(lastIndex, match.index + match[0].length);
      if (sentence.trim()) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }
    
    // Update buffer with remaining text
    this.textBuffer = text.substring(lastIndex);
    
    return sentences;
  }

  /**
   * Generate audio for a sentence using OpenAI TTS API
   */
  private async generateAudio(text: string): Promise<void> {
    if (this.stopped) return;

    try {
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1', // or 'tts-1-hd' for higher quality
          input: text,
          voice: this.voice,
          response_format: 'mp3',
          speed: this.speed
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('OpenAI TTS: API quota exceeded or billing issue. Please check your OpenAI account.');
          return; // Silently skip this request
        }
        throw new Error(`OpenAI TTS API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Configure audio element
      audio.volume = 0.8;
      audio.preload = 'auto';

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl); // Clean up blob URL
        this.isPlaying = false;
        this.currentAudio = null;
        this.processQueue(); // Play next in queue
      };

      audio.onerror = (e) => {
        console.warn('Audio playback error:', e);
        URL.revokeObjectURL(audioUrl);
        this.isPlaying = false;
        this.currentAudio = null;
        this.processQueue(); // Try next in queue
      };

      // Add to queue
      this.audioQueue.push(audio);

    } catch (error) {
      console.warn('OpenAI TTS generation failed:', error);
      // Continue with next sentence instead of stopping everything
    }
  }

  /**
   * Process the audio queue
   */
  private processQueue(): void {
    if (this.stopped || this.isPlaying) return;
    
    const nextAudio = this.audioQueue.shift();
    if (!nextAudio) return;

    this.currentAudio = nextAudio;
    this.isPlaying = true;

    try {
      nextAudio.play().catch(error => {
        console.warn('Failed to play audio:', error);
        this.isPlaying = false;
        this.currentAudio = null;
        // Try next in queue
        setTimeout(() => this.processQueue(), 100);
      });
    } catch (error) {
      console.warn('Audio play error:', error);
      this.isPlaying = false;
      this.currentAudio = null;
      setTimeout(() => this.processQueue(), 100);
    }
  }
}

/**
 * Create OpenAI TTS adapter if API key is available
 */
export function createOpenAITTSAdapter(): OpenAITTSAdapter | null {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return null;
  
  return new OpenAITTSAdapter(apiKey);
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