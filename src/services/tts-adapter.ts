/**
 * Text-to-Speech adapter interface
 */
export interface TTSAdapter {
  begin(requestId: string): TTSSession;
  setVoice(voiceId: string): void;
  setRate(rate: number): void;
  setEnabled(enabled: boolean): void;
  getVoices(): SpeechSynthesisVoice[];
  isSupported(): boolean;
}

/**
 * TTS session for streaming text input
 */
export interface TTSSession {
  feed(textChunk: string): void;
  stop(reason?: string): void;
  isActive(): boolean;
}

/**
 * Web Speech API implementation of TTS adapter
 */
export class WebSpeechTTSAdapter implements TTSAdapter {
  private enabled = true;
  private voiceId = '';
  private rate = 1.0;
  private pitch = 1.0;
  private volume = 0.7;
  private activeSessions = new Map<string, WebSpeechTTSSession>();

  constructor() {
    // Load settings from localStorage
    this.loadSettings();
  }

  begin(requestId: string): TTSSession {
    // Stop any existing session
    const existingSession = this.activeSessions.get(requestId);
    if (existingSession) {
      existingSession.stop('new_session');
    }

    const session = new WebSpeechTTSSession(
      requestId,
      this.enabled,
      this.voiceId,
      this.rate,
      this.pitch,
      this.volume,
      () => this.activeSessions.delete(requestId)
    );

    this.activeSessions.set(requestId, session);
    return session;
  }

  setVoice(voiceId: string): void {
    this.voiceId = voiceId;
    this.saveSettings();
  }

  setRate(rate: number): void {
    this.rate = Math.max(0.1, Math.min(2.0, rate));
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

  getVoices(): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return [];
    return Array.from(speechSynthesis.getVoices());
  }

  isSupported(): boolean {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('chess-coach-tts-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.enabled = settings.enabled ?? true;
        this.voiceId = settings.voiceId ?? '';
        this.rate = settings.rate ?? 1.0;
        this.pitch = settings.pitch ?? 1.0;
        this.volume = settings.volume ?? 0.7;
      }
    } catch (e) {
      console.warn('Failed to load TTS settings:', e);
    }
  }

  private saveSettings(): void {
    try {
      const settings = {
        enabled: this.enabled,
        voiceId: this.voiceId,
        rate: this.rate,
        pitch: this.pitch,
        volume: this.volume
      };
      localStorage.setItem('chess-coach-tts-settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save TTS settings:', e);
    }
  }
}

/**
 * Web Speech API session implementation
 */
class WebSpeechTTSSession implements TTSSession {
  private requestId: string;
  private enabled: boolean;
  private voiceId: string;
  private rate: number;
  private pitch: number;
  private volume: number;
  private onCleanup: () => void;
  
  private textBuffer = '';
  private utteranceQueue: SpeechSynthesisUtterance[] = [];
  private isPlaying = false;
  private stopped = false;
  
  // Sentence boundary regex
  private static SENTENCE_REGEX = /[.!?]+\s+/g;

  constructor(
    requestId: string,
    enabled: boolean,
    voiceId: string,
    rate: number,
    pitch: number,
    volume: number,
    onCleanup: () => void
  ) {
    this.requestId = requestId;
    this.enabled = enabled;
    this.voiceId = voiceId;
    this.rate = rate;
    this.pitch = pitch;
    this.volume = volume;
    this.onCleanup = onCleanup;
  }

  feed(textChunk: string): void {
    if (!this.enabled || this.stopped || !speechSynthesis) return;

    this.textBuffer += textChunk;
    this.processBuffer();
  }

  stop(reason = 'user_requested'): void {
    if (this.stopped) return;
    
    this.stopped = true;
    this.textBuffer = '';
    
    // Cancel current speech
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    
    // Clear queue
    this.utteranceQueue = [];
    this.isPlaying = false;
    
    console.log(`TTS session ${this.requestId} stopped: ${reason}`);
    this.onCleanup();
  }

  isActive(): boolean {
    return !this.stopped && (this.isPlaying || this.utteranceQueue.length > 0);
  }

  /**
   * Process text buffer and extract complete sentences
   */
  private processBuffer(): void {
    const sentences = this.extractSentences(this.textBuffer);
    
    for (const sentence of sentences) {
      this.queueSentence(sentence.trim());
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

    WebSpeechTTSSession.SENTENCE_REGEX.lastIndex = 0;
    
    while ((match = WebSpeechTTSSession.SENTENCE_REGEX.exec(text)) !== null) {
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
   * Queue a sentence for speech synthesis
   */
  private queueSentence(sentence: string): void {
    if (!sentence.trim() || this.stopped) return;

    const utterance = new SpeechSynthesisUtterance(sentence);
    
    // Configure utterance
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;
    
    // Set voice if specified
    if (this.voiceId) {
      const voice = speechSynthesis.getVoices().find(v => v.voiceURI === this.voiceId);
      if (voice) {
        utterance.voice = voice;
      }
    }

    // Add event listeners
    utterance.onstart = () => {
      this.isPlaying = true;
    };

    utterance.onend = () => {
      this.isPlaying = false;
      this.processQueue(); // Process next item in queue
    };

    utterance.onerror = (event) => {
      console.warn('TTS error:', event.error);
      this.isPlaying = false;
      this.processQueue(); // Try to continue with next item
    };

    this.utteranceQueue.push(utterance);
  }

  /**
   * Process the utterance queue
   */
  private processQueue(): void {
    if (this.stopped || this.isPlaying || speechSynthesis.speaking) return;
    
    const nextUtterance = this.utteranceQueue.shift();
    if (!nextUtterance) return;

    try {
      speechSynthesis.speak(nextUtterance);
    } catch (error) {
      console.warn('Failed to speak utterance:', error);
      this.isPlaying = false;
      // Try next in queue
      setTimeout(() => this.processQueue(), 100);
    }
  }
}

import { createOpenAITTSAdapter } from './openai-tts-adapter';

/**
 * OpenAI-only TTS adapter
 */
class OpenAIOnlyTTSAdapter implements TTSAdapter {
  private openaiAdapter: TTSAdapter | null = null;

  constructor() {
    this.initializeOpenAI();
  }

  private initializeOpenAI(): void {
    try {
      this.openaiAdapter = createOpenAITTSAdapter();
      if (this.openaiAdapter) {
        console.log('OpenAI TTS initialized successfully');
      } else {
        console.warn('OpenAI TTS adapter could not be created - missing API key?');
      }
    } catch (error) {
      console.warn('Failed to initialize OpenAI TTS:', error);
    }
  }

  begin(requestId: string): TTSSession {
    if (!this.openaiAdapter) {
      // Return a no-op session if OpenAI TTS is not available
      return new NoOpTTSSession(requestId);
    }
    return this.openaiAdapter.begin(requestId);
  }

  setVoice(voiceId: string): void {
    if (this.openaiAdapter) {
      this.openaiAdapter.setVoice(voiceId);
    }
  }

  setRate(rate: number): void {
    if (this.openaiAdapter) {
      this.openaiAdapter.setRate(rate);
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.openaiAdapter) {
      this.openaiAdapter.setEnabled(enabled);
    }
  }

  getVoices(): any[] {
    if (!this.openaiAdapter) return [];
    return this.openaiAdapter.getVoices();
  }

  isSupported(): boolean {
    return this.openaiAdapter?.isSupported() ?? false;
  }

  /**
   * Reinitialize OpenAI adapter (e.g., when API key becomes available)
   */
  reinitialize(): boolean {
    this.initializeOpenAI();
    return this.isSupported();
  }

  /**
   * Check if OpenAI TTS is available
   */
  isOpenAIAvailable(): boolean {
    return this.openaiAdapter !== null;
  }
}

/**
 * No-op TTS session for when OpenAI TTS is not available
 */
class NoOpTTSSession implements TTSSession {
  constructor(requestId: string) {
    console.warn(`TTS session ${requestId} - OpenAI TTS not available, audio disabled`);
  }

  feed(_textChunk: string): void {
    // No-op
  }

  stop(_reason = 'user_requested'): void {
    // No-op
  }

  isActive(): boolean {
    return false;
  }
}

/**
 * Global TTS adapter instance
 */
export const ttsAdapter = new OpenAIOnlyTTSAdapter();