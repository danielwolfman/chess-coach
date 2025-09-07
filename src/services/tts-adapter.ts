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

  // Clean text to remove JSON artifacts and keep only natural speech
  private cleanTextForTts(text: string): string {
    let s = text.replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();
    s = s
      .replace(/^\s*\{[\s\S]*?"name"\s*:\s*"/is, '')
      .replace(/",?\s*"why"\s*:\s*"/is, '. ')
      .replace(/",?\s*"better_plan"\s*:\s*"/is, '. Here\'s a better plan: ')
      .replace(/",?\s*"line"\s*:\s*\[[\s\S]*?\]/is, '')
      .replace(/"\s*\}?\s*$/is, '');
    s = s.replace(/^[\s"'{}\[\]]+|[\s"'{}\[\]]+$/g, '');
    s = s.replace(/\\"/g, '"').replace(/\s{2,}/g, ' ').trim();
    return s;
  }

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

    const cleaned = this.cleanTextForTts(sentence);
    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    
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
import { createGoogleCloudTTSAdapter } from './google-cloud-tts-adapter';
import { createLemonfoxTTSAdapter } from './lemonfox-tts-adapter';

export type TTSProvider = 'openai' | 'google-cloud' | 'lemonfox' | 'web-speech';

type ProviderMeta = {
  id: TTSProvider;
  name: string;
  apiKeyStorageKey?: string;
  apiKeyLabel?: string;
  apiKeyPlaceholder?: string;
};

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiKeyStorageKey: 'chess-coach-openai-api-key',
    apiKeyLabel: 'OpenAI API Key',
    apiKeyPlaceholder: 'sk-proj-...'
  },
  {
    id: 'google-cloud',
    name: 'Google Cloud',
    apiKeyStorageKey: 'chess-coach-google-cloud-api-key',
    apiKeyLabel: 'Google Cloud API Key',
    apiKeyPlaceholder: 'AIza...'
  },
  {
    id: 'lemonfox',
    name: 'Lemonfox.ai',
    apiKeyStorageKey: 'chess-coach-lemonfox-api-key',
    apiKeyLabel: 'Lemonfox API Key',
    apiKeyPlaceholder: 'lfx_...'
  },
  {
    id: 'web-speech',
    name: 'Browser (Web Speech)'
  }
];

/**
 * Multi-provider TTS adapter that supports OpenAI, Google Cloud, and Web Speech
 */
class MultiProviderTTSAdapter implements TTSAdapter {
  private openaiAdapter: TTSAdapter | null = null;
  private googleCloudAdapter: TTSAdapter | null = null;
  private lemonfoxAdapter: TTSAdapter | null = null;
  private webSpeechAdapter: TTSAdapter | null = null;
  private currentProvider: TTSProvider = 'openai';

  constructor() {
    this.initializeAdapters();
    this.loadProviderSettings();
  }

  private initializeAdapters(): void {
    try {
      this.openaiAdapter = createOpenAITTSAdapter();
      if (this.openaiAdapter) {
        console.log('OpenAI TTS initialized successfully');
      }
    } catch (error) {
      console.warn('Failed to initialize OpenAI TTS:', error);
    }

    try {
      this.googleCloudAdapter = createGoogleCloudTTSAdapter();
      if (this.googleCloudAdapter) {
        console.log('Google Cloud TTS initialized successfully');
      }
    } catch (error) {
      console.warn('Failed to initialize Google Cloud TTS:', error);
    }

    try {
      this.lemonfoxAdapter = createLemonfoxTTSAdapter();
      if (this.lemonfoxAdapter) {
        console.log('Lemonfox TTS initialized successfully');
      }
    } catch (error) {
      console.warn('Failed to initialize Lemonfox TTS:', error);
    }

    try {
      this.webSpeechAdapter = new WebSpeechTTSAdapter();
      if (this.webSpeechAdapter.isSupported()) {
        console.log('Web Speech TTS initialized successfully');
      }
    } catch (error) {
      console.warn('Failed to initialize Web Speech TTS:', error);
    }
  }

  private getCurrentAdapter(): TTSAdapter | null {
    switch (this.currentProvider) {
      case 'openai':
        return this.openaiAdapter;
      case 'google-cloud':
        return this.googleCloudAdapter;
      case 'lemonfox':
        return this.lemonfoxAdapter;
      case 'web-speech':
        return this.webSpeechAdapter;
      default:
        return this.openaiAdapter;
    }
  }

  begin(requestId: string): TTSSession {
    const adapter = this.getCurrentAdapter();
    if (!adapter || !adapter.isSupported()) {
      // Fall back to any available adapter
      const fallbackAdapter = this.openaiAdapter || this.googleCloudAdapter || this.lemonfoxAdapter || this.webSpeechAdapter;
      if (fallbackAdapter && fallbackAdapter.isSupported()) {
        console.warn(`TTS fallback: using ${this.getAdapterName(fallbackAdapter)} instead of ${this.currentProvider}`);
        return fallbackAdapter.begin(requestId);
      }
      // Return a no-op session if no TTS is available
      return new NoOpTTSSession(requestId);
    }
    return adapter.begin(requestId);
  }

  setVoice(voiceId: string): void {
    const adapter = this.getCurrentAdapter();
    if (adapter) {
      adapter.setVoice(voiceId);
    }
  }

  setRate(rate: number): void {
    const adapter = this.getCurrentAdapter();
    if (adapter) {
      adapter.setRate(rate);
    }
  }

  setEnabled(enabled: boolean): void {
    const adapter = this.getCurrentAdapter();
    if (adapter) {
      adapter.setEnabled(enabled);
    }
  }

  getVoices(): any[] {
    const adapter = this.getCurrentAdapter();
    if (!adapter) return [];
    return adapter.getVoices();
  }

  isSupported(): boolean {
    const adapter = this.getCurrentAdapter();
    return adapter?.isSupported() ?? false;
  }

  /**
   * Set the current TTS provider
   */
  setProvider(provider: TTSProvider): boolean {
    const adapter = this.getAdapterByProvider(provider);
    // Always set the provider preference, even if not currently supported.
    // The UI and begin() will handle fallback appropriately.
    this.currentProvider = provider;
    this.saveProviderSettings();
    return !!(adapter && adapter.isSupported());
  }

  /**
   * Get the current TTS provider
   */
  getProvider(): TTSProvider {
    return this.currentProvider;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): Array<{id: TTSProvider, name: string, available: boolean}> {
    return PROVIDERS.map(p => ({
      id: p.id,
      name: p.name,
      available: this.getAdapterByProvider(p.id)?.isSupported() ?? (p.id === 'web-speech' ? (this.webSpeechAdapter?.isSupported() ?? false) : false)
    }));
  }

  /**
   * Provider metadata for UI (names, storage keys, etc.)
   */
  getProvidersMeta(): ProviderMeta[] {
    return [...PROVIDERS];
  }

  private getAdapterByProvider(provider: TTSProvider): TTSAdapter | null {
    switch (provider) {
      case 'openai':
        return this.openaiAdapter;
      case 'google-cloud':
        return this.googleCloudAdapter;
      case 'lemonfox':
        return this.lemonfoxAdapter;
      case 'web-speech':
        return this.webSpeechAdapter;
      default:
        return null;
    }
  }

  private getAdapterName(adapter: TTSAdapter): string {
    if (adapter === this.openaiAdapter) return 'OpenAI';
    if (adapter === this.googleCloudAdapter) return 'Google Cloud';
    if (adapter === this.lemonfoxAdapter) return 'Lemonfox';
    if (adapter === this.webSpeechAdapter) return 'Web Speech';
    return 'Unknown';
  }

  /**
   * Back-compat helper used by TTSSettings
   * Returns whether the OpenAI TTS provider is available/configured
   */
  isOpenAIAvailable(): boolean {
    return this.openaiAdapter?.isSupported() ?? false;
  }

  /**
   * Reinitialize all adapters (e.g., when API keys become available)
   */
  reinitialize(): boolean {
    this.initializeAdapters();
    return this.isSupported();
  }

  /**
   * Check which providers are available
   */
  getProviderAvailability(): Record<TTSProvider, boolean> {
    return {
      'openai': this.openaiAdapter?.isSupported() ?? false,
      'google-cloud': this.googleCloudAdapter?.isSupported() ?? false,
      'lemonfox': this.lemonfoxAdapter?.isSupported() ?? false,
      'web-speech': this.webSpeechAdapter?.isSupported() ?? false
    };
  }

  private loadProviderSettings(): void {
    try {
      const saved = localStorage.getItem('chess-coach-tts-provider');
      if (saved) {
        const provider = saved as TTSProvider;
        // Always honor saved preference; support check happens later.
        this.currentProvider = provider;
      }
    } catch (e) {
      console.warn('Failed to load TTS provider settings:', e);
    }
  }

  private saveProviderSettings(): void {
    try {
      localStorage.setItem('chess-coach-tts-provider', this.currentProvider);
    } catch (e) {
      console.warn('Failed to save TTS provider settings:', e);
    }
  }
}

/**
 * No-op TTS session for when OpenAI TTS is not available
 */
class NoOpTTSSession implements TTSSession {
  constructor(requestId: string) {
    console.warn(`TTS session ${requestId} - No TTS provider available; audio disabled.`);
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
export const ttsAdapter = new MultiProviderTTSAdapter();
