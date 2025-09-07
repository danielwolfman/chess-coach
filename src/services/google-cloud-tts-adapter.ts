import type { TTSAdapter, TTSSession } from './tts-adapter';

/**
 * Google Cloud Text-to-Speech API implementation
 * Uses Google Cloud TTS API with high-quality voices
 */
export class GoogleCloudTTSAdapter implements TTSAdapter {
  private apiKey: string;
  private baseUrl = 'https://texttospeech.googleapis.com/v1';
  private enabled = true;
  private voiceId = 'en-US-Standard-C';
  private languageCode = 'en-US';
  private ssmlGender: 'NEUTRAL' | 'FEMALE' | 'MALE' = 'FEMALE';
  private speakingRate = 1.0;
  private pitch = 0.0;
  private activeSessions = new Map<string, GoogleCloudTTSSession>();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.loadSettings();
  }

  begin(requestId: string): TTSSession {
    // Stop any existing session
    const existingSession = this.activeSessions.get(requestId);
    if (existingSession) {
      existingSession.stop('new_session');
    }

    const session = new GoogleCloudTTSSession(
      requestId,
      this.apiKey,
      this.baseUrl,
      this.enabled,
      this.voiceId,
      this.languageCode,
      this.ssmlGender,
      this.speakingRate,
      this.pitch,
      () => this.activeSessions.delete(requestId)
    );

    this.activeSessions.set(requestId, session);
    return session;
  }

  setVoice(voiceId: string): void {
    this.voiceId = voiceId;
    // Extract language code from voice ID (e.g., "en-US-Standard-C" -> "en-US")
    const match = voiceId.match(/^([a-z]{2}-[A-Z]{2})/);
    if (match) {
      this.languageCode = match[1];
    }
    this.saveSettings();
  }

  setRate(rate: number): void {
    // Google Cloud TTS supports 0.25 to 4.0 speaking rate
    this.speakingRate = Math.max(0.25, Math.min(4.0, rate));
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
    // Pre-defined list of popular Google Cloud TTS voices
    return [
      // English (US) voices
      { id: 'en-US-Standard-A', name: 'English (US) - Standard A', description: 'Male voice', gender: 'MALE', languageCode: 'en-US' },
      { id: 'en-US-Standard-B', name: 'English (US) - Standard B', description: 'Male voice', gender: 'MALE', languageCode: 'en-US' },
      { id: 'en-US-Standard-C', name: 'English (US) - Standard C', description: 'Female voice', gender: 'FEMALE', languageCode: 'en-US' },
      { id: 'en-US-Standard-D', name: 'English (US) - Standard D', description: 'Male voice', gender: 'MALE', languageCode: 'en-US' },
      { id: 'en-US-Standard-E', name: 'English (US) - Standard E', description: 'Female voice', gender: 'FEMALE', languageCode: 'en-US' },
      { id: 'en-US-Standard-F', name: 'English (US) - Standard F', description: 'Female voice', gender: 'FEMALE', languageCode: 'en-US' },
      { id: 'en-US-Standard-G', name: 'English (US) - Standard G', description: 'Female voice', gender: 'FEMALE', languageCode: 'en-US' },
      { id: 'en-US-Standard-H', name: 'English (US) - Standard H', description: 'Female voice', gender: 'FEMALE', languageCode: 'en-US' },
      { id: 'en-US-Standard-I', name: 'English (US) - Standard I', description: 'Male voice', gender: 'MALE', languageCode: 'en-US' },
      { id: 'en-US-Standard-J', name: 'English (US) - Standard J', description: 'Male voice', gender: 'MALE', languageCode: 'en-US' },
      
      // Neural voices (higher quality, more expensive)
      { id: 'en-US-Neural2-A', name: 'English (US) - Neural A', description: 'Male neural voice (premium)', gender: 'MALE', languageCode: 'en-US' },
      { id: 'en-US-Neural2-C', name: 'English (US) - Neural C', description: 'Female neural voice (premium)', gender: 'FEMALE', languageCode: 'en-US' },
      { id: 'en-US-Neural2-D', name: 'English (US) - Neural D', description: 'Male neural voice (premium)', gender: 'MALE', languageCode: 'en-US' },
      { id: 'en-US-Neural2-F', name: 'English (US) - Neural F', description: 'Female neural voice (premium)', gender: 'FEMALE', languageCode: 'en-US' },
      
      // WaveNet voices (highest quality, most expensive)
      { id: 'en-US-Wavenet-A', name: 'English (US) - WaveNet A', description: 'Male WaveNet voice (premium)', gender: 'MALE', languageCode: 'en-US' },
      { id: 'en-US-Wavenet-B', name: 'English (US) - WaveNet B', description: 'Male WaveNet voice (premium)', gender: 'MALE', languageCode: 'en-US' },
      { id: 'en-US-Wavenet-C', name: 'English (US) - WaveNet C', description: 'Female WaveNet voice (premium)', gender: 'FEMALE', languageCode: 'en-US' },
      { id: 'en-US-Wavenet-D', name: 'English (US) - WaveNet D', description: 'Male WaveNet voice (premium)', gender: 'MALE', languageCode: 'en-US' },
      { id: 'en-US-Wavenet-E', name: 'English (US) - WaveNet E', description: 'Female WaveNet voice (premium)', gender: 'FEMALE', languageCode: 'en-US' },
      { id: 'en-US-Wavenet-F', name: 'English (US) - WaveNet F', description: 'Female WaveNet voice (premium)', gender: 'FEMALE', languageCode: 'en-US' },
      
      // English (UK) voices
      { id: 'en-GB-Standard-A', name: 'English (UK) - Standard A', description: 'Female voice', gender: 'FEMALE', languageCode: 'en-GB' },
      { id: 'en-GB-Standard-B', name: 'English (UK) - Standard B', description: 'Male voice', gender: 'MALE', languageCode: 'en-GB' },
      { id: 'en-GB-Standard-C', name: 'English (UK) - Standard C', description: 'Female voice', gender: 'FEMALE', languageCode: 'en-GB' },
      { id: 'en-GB-Standard-D', name: 'English (UK) - Standard D', description: 'Male voice', gender: 'MALE', languageCode: 'en-GB' },
      { id: 'en-GB-Wavenet-A', name: 'English (UK) - WaveNet A', description: 'Female WaveNet voice (premium)', gender: 'FEMALE', languageCode: 'en-GB' },
      { id: 'en-GB-Wavenet-B', name: 'English (UK) - WaveNet B', description: 'Male WaveNet voice (premium)', gender: 'MALE', languageCode: 'en-GB' },
      
      // English (AU) voices
      { id: 'en-AU-Standard-A', name: 'English (Australia) - Standard A', description: 'Female voice', gender: 'FEMALE', languageCode: 'en-AU' },
      { id: 'en-AU-Standard-B', name: 'English (Australia) - Standard B', description: 'Male voice', gender: 'MALE', languageCode: 'en-AU' },
      { id: 'en-AU-Standard-C', name: 'English (Australia) - Standard C', description: 'Female voice', gender: 'FEMALE', languageCode: 'en-AU' },
      { id: 'en-AU-Standard-D', name: 'English (Australia) - Standard D', description: 'Male voice', gender: 'MALE', languageCode: 'en-AU' },
    ];
  }

  isSupported(): boolean {
    return !!this.apiKey && typeof fetch !== 'undefined';
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('chess-coach-google-cloud-tts-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.enabled = settings.enabled ?? true;
        this.voiceId = settings.voiceId ?? 'en-US-Standard-C';
        this.languageCode = settings.languageCode ?? 'en-US';
        this.ssmlGender = settings.ssmlGender ?? 'FEMALE';
        this.speakingRate = settings.speakingRate ?? 1.0;
        this.pitch = settings.pitch ?? 0.0;
      }
    } catch (e) {
      console.warn('Failed to load Google Cloud TTS settings:', e);
    }
  }

  private saveSettings(): void {
    try {
      const settings = {
        enabled: this.enabled,
        voiceId: this.voiceId,
        languageCode: this.languageCode,
        ssmlGender: this.ssmlGender,
        speakingRate: this.speakingRate,
        pitch: this.pitch
      };
      localStorage.setItem('chess-coach-google-cloud-tts-settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save Google Cloud TTS settings:', e);
    }
  }
}

/**
 * Google Cloud TTS session implementation with full-text processing
 * Optimized for sentence-by-sentence processing with audio queue
 */
class GoogleCloudTTSSession implements TTSSession {
  private requestId: string;
  private apiKey: string;
  private baseUrl: string;
  private enabled: boolean;
  private voiceId: string;
  private languageCode: string;
  private ssmlGender: 'NEUTRAL' | 'FEMALE' | 'MALE';
  private speakingRate: number;
  private pitch: number;
  private onCleanup: () => void;
  
  private textBuffer = '';
  private isPlaying = false;
  private stopped = false;
  private currentAudio: HTMLAudioElement | null = null;
  private processingAudio = false;
  
  // Sentence-by-sentence processing
  private processedText = '';
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
    voiceId: string,
    languageCode: string,
    ssmlGender: 'NEUTRAL' | 'FEMALE' | 'MALE',
    speakingRate: number,
    pitch: number,
    onCleanup: () => void
  ) {
    this.requestId = requestId;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.enabled = enabled;
    this.voiceId = voiceId;
    this.languageCode = languageCode;
    this.ssmlGender = ssmlGender;
    this.speakingRate = speakingRate;
    this.pitch = pitch;
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
    }, GoogleCloudTTSSession.PROCESS_DELAY);
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
    
    console.log(`Google Cloud TTS session ${this.requestId} stopped: ${reason}`);
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
          console.log(`[${new Date().toLocaleTimeString()}] Google Cloud TTS processing: "${cleanedText}"`);
          
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
        console.log(`[${new Date().toLocaleTimeString()}] Google Cloud TTS processing remaining: "${cleanedText}"`);
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
      console.warn('Failed to generate Google Cloud TTS audio for text:', error);
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
    console.log(`[${new Date().toLocaleTimeString()}] Google Cloud TTS starting playback`);
    
    while (this.audioQueue.length > 0 && !this.stopped) {
      const audio = this.audioQueue.shift()!;
      
      try {
        this.currentAudio = audio;
        this.isPlaying = true;
        
        await this.playAudio(audio);
        
      } catch (error) {
        console.warn('Failed to play Google Cloud TTS audio segment:', error);
      } finally {
        this.currentAudio = null;
        this.isPlaying = false;
      }
    }
    
    this.playingQueue = false;
    console.log(`[${new Date().toLocaleTimeString()}] Google Cloud TTS playback completed`);
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
        reject(new Error('Google Cloud TTS audio playback failed'));
      };
      
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      
      audio.play().catch(reject);
    });
  }

  /**
   * Generate audio chunk using Google Cloud TTS API and return blob
   */
  private async generateAudioChunk(text: string): Promise<Blob | null> {
    try {
      // Extract gender from voice ID or use configured gender
      let gender = this.ssmlGender;
      const voice = this.getVoiceInfo(this.voiceId);
      if (voice?.gender) {
        gender = voice.gender as 'NEUTRAL' | 'FEMALE' | 'MALE';
      }

      const requestBody = {
        input: {
          text: text
        },
        voice: {
          languageCode: this.languageCode,
          name: this.voiceId,
          ssmlGender: gender
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: this.speakingRate,
          pitch: this.pitch,
          volumeGainDb: 0.0,
          sampleRateHertz: 24000
        }
      };

      const response = await fetch(`${this.baseUrl}/text:synthesize?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          console.warn('Google Cloud TTS: Invalid request.', errorData);
          return null;
        }
        if (response.status === 401) {
          console.warn('Google Cloud TTS: Invalid API key or insufficient permissions.');
          return null;
        }
        if (response.status === 403) {
          console.warn('Google Cloud TTS: API not enabled or quota exceeded.');
          return null;
        }
        if (response.status === 429) {
          console.warn('Google Cloud TTS: Rate limit exceeded. Please wait and try again.');
          return null;
        }
        const errorText = await response.text();
        throw new Error(`Google Cloud TTS API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.audioContent) {
        throw new Error('Google Cloud TTS API did not return audio content');
      }

      // Convert base64 audio content to blob
      const audioBase64 = data.audioContent;
      const audioBytes = atob(audioBase64);
      const audioBuffer = new Uint8Array(audioBytes.length);
      
      for (let i = 0; i < audioBytes.length; i++) {
        audioBuffer[i] = audioBytes.charCodeAt(i);
      }

      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      return audioBlob;

    } catch (error) {
      console.warn('Google Cloud TTS chunk generation failed:', error);
      return null;
    }
  }

  /**
   * Get voice information from the predefined voice list
   */
  private getVoiceInfo(voiceId: string): any {
    // Create a temporary adapter to get voice list
    const voices = [
      { id: 'en-US-Standard-A', gender: 'MALE' },
      { id: 'en-US-Standard-B', gender: 'MALE' },
      { id: 'en-US-Standard-C', gender: 'FEMALE' },
      { id: 'en-US-Standard-D', gender: 'MALE' },
      { id: 'en-US-Standard-E', gender: 'FEMALE' },
      { id: 'en-US-Standard-F', gender: 'FEMALE' },
      { id: 'en-US-Standard-G', gender: 'FEMALE' },
      { id: 'en-US-Standard-H', gender: 'FEMALE' },
      { id: 'en-US-Standard-I', gender: 'MALE' },
      { id: 'en-US-Standard-J', gender: 'MALE' },
      { id: 'en-US-Neural2-A', gender: 'MALE' },
      { id: 'en-US-Neural2-C', gender: 'FEMALE' },
      { id: 'en-US-Neural2-D', gender: 'MALE' },
      { id: 'en-US-Neural2-F', gender: 'FEMALE' },
      { id: 'en-US-Wavenet-A', gender: 'MALE' },
      { id: 'en-US-Wavenet-B', gender: 'MALE' },
      { id: 'en-US-Wavenet-C', gender: 'FEMALE' },
      { id: 'en-US-Wavenet-D', gender: 'MALE' },
      { id: 'en-US-Wavenet-E', gender: 'FEMALE' },
      { id: 'en-US-Wavenet-F', gender: 'FEMALE' },
      { id: 'en-GB-Standard-A', gender: 'FEMALE' },
      { id: 'en-GB-Standard-B', gender: 'MALE' },
      { id: 'en-GB-Standard-C', gender: 'FEMALE' },
      { id: 'en-GB-Standard-D', gender: 'MALE' },
      { id: 'en-GB-Wavenet-A', gender: 'FEMALE' },
      { id: 'en-GB-Wavenet-B', gender: 'MALE' },
      { id: 'en-AU-Standard-A', gender: 'FEMALE' },
      { id: 'en-AU-Standard-B', gender: 'MALE' },
      { id: 'en-AU-Standard-C', gender: 'FEMALE' },
      { id: 'en-AU-Standard-D', gender: 'MALE' },
    ];
    
    return voices.find(v => v.id === voiceId);
  }
}

/**
 * Create Google Cloud TTS adapter if API key is available
 */
export function createGoogleCloudTTSAdapter(): GoogleCloudTTSAdapter | null {
  const apiKey = getGoogleCloudApiKey();
  if (!apiKey) return null;
  
  return new GoogleCloudTTSAdapter(apiKey);
}

/**
 * Get Google Cloud API key from configuration
 */
function getGoogleCloudApiKey(): string | null {
  // Check localStorage first (user-provided key)
  if (typeof window !== 'undefined') {
    const userApiKey = localStorage.getItem('chess-coach-google-cloud-api-key');
    if (userApiKey) return userApiKey;
  }

  // Check environment variable
  const envKey = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;
  if (envKey) return envKey;

  return null;
}
