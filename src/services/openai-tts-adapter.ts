import type { TTSAdapter, TTSSession } from './tts-adapter';

/**
 * OpenAI TTS API implementation
 * Uses OpenAI's high-quality text-to-speech API
 */
export class OpenAITTSAdapter implements TTSAdapter {
  private apiKey: string;
  private baseUrl: string;
  private enabled = true;
  private voice: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'onyx' | 'nova' | 'sage' | 'shimmer' | 'verse' = 'alloy';
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
    const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];
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
      { id: 'ash', name: 'Ash', description: 'Clear, authoritative voice' },
      { id: 'ballad', name: 'Ballad', description: 'Melodic, expressive voice' },
      { id: 'coral', name: 'Coral', description: 'Warm, friendly voice' },
      { id: 'echo', name: 'Echo', description: 'Clear, articulate voice' },
      { id: 'fable', name: 'Fable', description: 'Warm, storytelling voice' },
      { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative voice' },
      { id: 'nova', name: 'Nova', description: 'Bright, energetic voice' },
      { id: 'sage', name: 'Sage', description: 'Wise, thoughtful voice' },
      { id: 'shimmer', name: 'Shimmer', description: 'Soft, gentle voice' },
      { id: 'verse', name: 'Verse', description: 'Poetic, rhythmic voice' }
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
 * OpenAI TTS session implementation with full-text processing
 * Optimized to use single API call instead of sentence-by-sentence processing
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
  private isPlaying = false;
  private stopped = false;
  private currentAudio: HTMLAudioElement | null = null;
  private processingAudio = false;
  
  // Sentence-by-sentence processing
  private processedText = ''; // Text that has already been sent for TTS
  private audioQueue: HTMLAudioElement[] = [];
  private playingQueue = false;
  
  // Debounce timer for processing complete text
  private processTimer: NodeJS.Timeout | null = null;
  private static PROCESS_DELAY = 200; // ms to wait for sentence completion

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

  /**
   * Clean text to remove JSON artifacts and make it suitable for TTS
   */
  private cleanTextForTts(text: string): string {
    // Normalize whitespace first
    let s = text.replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();

    // Remove leading JSON wrapper and key preceding the current value (dotAll to span newlines)
    s = s
      .replace(/^\s*\{[\s\S]*?"name"\s*:\s*"/is, '')
      .replace(/",?\s*"why"\s*:\s*"/is, '. ')
      .replace(/",?\s*"better_plan"\s*:\s*"/is, '. Here\'s a better plan: ')
      .replace(/",?\s*"line"\s*:\s*\[[\s\S]*?\]/is, '')
      .replace(/"\s*\}?\s*$/is, '');

    // Strip any stray braces/quotes left at boundaries
    s = s.replace(/^[\s"'{}\[\]]+|[\s"'{}\[\]]+$/g, '');

    // Unescape quotes and tidy spaces
    s = s.replace(/\\"/g, '"').replace(/\s{2,}/g, ' ').trim();

    return s;
  }

  feed(textChunk: string): void {
    if (!this.enabled || this.stopped) return;

    this.textBuffer += textChunk;
    
    // Check for complete sentences immediately
    this.processAvailableSentences();
    
    // Also set a debounce timer for any remaining text
    if (this.processTimer) {
      clearTimeout(this.processTimer);
    }
    
    this.processTimer = setTimeout(() => {
      this.processRemainingText();
    }, OpenAITTSSession.PROCESS_DELAY);
  }

  stop(reason = 'user_requested'): void {
    if (this.stopped) return;
    
    this.stopped = true;
    this.textBuffer = '';
    this.processedText = '';
    
    // Clear debounce timer
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
    
    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    // Clear audio queue
    for (const audio of this.audioQueue) {
      audio.pause();
      if (audio.src) URL.revokeObjectURL(audio.src);
    }
    this.audioQueue = [];
    this.playingQueue = false;
    
    this.isPlaying = false;
    this.processingAudio = false;
    
    console.log(`OpenAI TTS session ${this.requestId} stopped: ${reason}`);
    this.onCleanup();
  }

  isActive(): boolean {
    return !this.stopped && (this.isPlaying || this.processingAudio || this.playingQueue || this.textBuffer.length > 0 || this.audioQueue.length > 0);
  }

  /**
   * Process complete sentences immediately as they arrive
   */
  private processAvailableSentences(): void {
    if (this.stopped) return;
    
    const unprocessedText = this.textBuffer.slice(this.processedText.length);
    
    // Find complete sentences (ending with . ! ? or line breaks)
    const sentenceRegex = /[.!?]+(?:\s|$)|(?:\n\s*){2,}/g;
    let match;
    let lastCompleteIndex = 0;
    
    while ((match = sentenceRegex.exec(unprocessedText)) !== null) {
      lastCompleteIndex = match.index + match[0].length;
    }
    
    if (lastCompleteIndex > 0) {
      const completeSentences = unprocessedText.slice(0, lastCompleteIndex).trim();
      if (completeSentences) {
        // Filter out JSON artifacts from TTS text
        const cleanedText = this.cleanTextForTts(completeSentences);
        if (cleanedText.trim()) {
          console.log(`[${new Date().toLocaleTimeString()}] TTS processing: "${cleanedText}"`);
          
          this.processedText += unprocessedText.slice(0, lastCompleteIndex);
          this.generateAudioForText(cleanedText);
        } else {
          // Skip empty or JSON-only content
          this.processedText += unprocessedText.slice(0, lastCompleteIndex);
        }
      }
    }
  }

  /**
   * Process any remaining text when streaming completes
   */
  private async processRemainingText(): Promise<void> {
    if (this.stopped) return;
    
    const remainingText = this.textBuffer.slice(this.processedText.length).trim();
    if (remainingText) {
      const cleanedText = this.cleanTextForTts(remainingText);
      if (cleanedText.trim()) {
        console.log(`[${new Date().toLocaleTimeString()}] TTS processing remaining: "${cleanedText}"`);
        this.processedText = this.textBuffer;
        await this.generateAudioForText(cleanedText);
      } else {
        this.processedText = this.textBuffer;
      }
    }
  }

  /**
   * Generate audio for text and add to queue
   */
  private async generateAudioForText(text: string): Promise<void> {
    if (this.stopped || !text.trim()) return;
    
    try {
      const audioBlob = await this.generateAudioChunk(text);
      if (audioBlob && !this.stopped) {
        const audio = await this.createAudioElement(audioBlob);
        this.audioQueue.push(audio);
        
        // Start playing queue if not already playing
        if (!this.playingQueue) {
          this.playAudioQueue();
        }
      }
    } catch (error) {
      console.warn('Failed to generate audio for text:', error);
    }
  }

  /**
   * Create audio element from blob
   */
  private async createAudioElement(audioBlob: Blob): Promise<HTMLAudioElement> {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.volume = 0.8;
    audio.preload = 'auto';
    
    // Clean up URL when audio ends or errors
    const cleanup = () => {
      URL.revokeObjectURL(audioUrl);
    };
    
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);
    
    return audio;
  }

  /**
   * Play audio queue sequentially
   */
  private async playAudioQueue(): Promise<void> {
    if (this.playingQueue || this.stopped) return;
    
    this.playingQueue = true;
    console.log(`[${new Date().toLocaleTimeString()}] TTS starting playback`);
    
    while (this.audioQueue.length > 0 && !this.stopped) {
      const audio = this.audioQueue.shift()!;
      
      try {
        this.currentAudio = audio;
        this.isPlaying = true;
        
        await this.playAudio(audio);
        
      } catch (error) {
        console.warn('Failed to play audio segment:', error);
      } finally {
        this.currentAudio = null;
        this.isPlaying = false;
      }
    }
    
    this.playingQueue = false;
    console.log(`[${new Date().toLocaleTimeString()}] TTS playback completed`);
  }

  /**
   * Play single audio element
   */
  private playAudio(audio: HTMLAudioElement): Promise<void> {
    return new Promise((resolve, reject) => {
      const onEnded = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        resolve();
      };
      
      const onError = (_e: Event) => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        reject(new Error('Audio playback failed'));
      };
      
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      
      audio.play().catch(reject);
    });
  }


  /**
   * Generate audio chunk and return blob
   */
  private async generateAudioChunk(text: string): Promise<Blob | null> {
    try {
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          input: text,
          voice: this.voice,
          response_format: 'mp3',
          speed: this.speed,
          instructions: 'Speak as a friendly, encouraging chess coach with a warm and supportive tone.'
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('OpenAI TTS: API quota exceeded or billing issue. Please check your OpenAI account.');
          return null;
        }
        const errorText = await response.text();
        throw new Error(`OpenAI TTS API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const audioBlob = await response.blob();
      return audioBlob;

    } catch (error) {
      console.warn('OpenAI TTS chunk generation failed:', error);
      return null;
    }
  }

  /**
   * Generate audio for complete text using OpenAI TTS API with streaming (for single chunks)
   */
  private async generateAudio(text: string): Promise<void> {
    if (this.stopped || this.isPlaying) return;

    const audioBlob = await this.generateAudioChunk(text);
    if (audioBlob && !this.stopped) {
      await this.playAudioBlob(audioBlob);
    }
  }

  /**
   * Play multiple audio blobs sequentially
   */
  private async playSequentialAudio(audioBlobs: Blob[]): Promise<void> {
    if (this.stopped || audioBlobs.length === 0) return;
    
    console.log(`[${new Date().toLocaleTimeString()}] TTS playing ${audioBlobs.length} audio chunks sequentially`);
    
    for (let i = 0; i < audioBlobs.length; i++) {
      if (this.stopped) break;
      
      console.log(`[${new Date().toLocaleTimeString()}] TTS playing chunk ${i + 1}/${audioBlobs.length}`);
      await this.playAudioBlob(audioBlobs[i]);
      
      // Wait for current audio to finish before playing next
      while (this.isPlaying && !this.stopped) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }


  /**
   * Play audio blob
   */
  private async playAudioBlob(audioBlob: Blob): Promise<void> {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    // Configure and play audio immediately
    audio.volume = 0.8;
    audio.preload = 'auto';

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      this.isPlaying = false;
      this.currentAudio = null;
    };

    audio.onerror = (e) => {
      console.warn('Audio playback error:', e);
      URL.revokeObjectURL(audioUrl);
      this.isPlaying = false;
      this.currentAudio = null;
    };

    // Play immediately instead of queuing
    this.currentAudio = audio;
    this.isPlaying = true;

    await audio.play();
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
