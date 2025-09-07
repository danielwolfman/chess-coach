import type { TTSAdapter, TTSSession } from './tts-adapter';

// Lemonfox TTS adapter modeled after OpenAI adapter
export class LemonfoxTTSAdapter implements TTSAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://api.lemonfox.ai/v1';
  private enabled = true;
  private voice: string = 'sarah';
  private speed = 1.0;
  private activeSessions = new Map<string, LemonfoxTTSSession>();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.loadSettings();
  }

  begin(requestId: string): TTSSession {
    const existing = this.activeSessions.get(requestId);
    if (existing) existing.stop('new_session');

    const session = new LemonfoxTTSSession(
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
    this.voice = voiceId;
    this.saveSettings();
  }

  setRate(rate: number): void {
    this.speed = Math.max(0.25, Math.min(4.0, rate));
    this.saveSettings();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      for (const s of this.activeSessions.values()) s.stop('disabled');
    }
    this.saveSettings();
  }

  // Popular Lemonfox voices (example list)
  getVoices(): any[] {
    return [
      { id: 'sarah', name: 'Sarah', description: 'Friendly, warm female' },
      { id: 'michael', name: 'Michael', description: 'Calm, neutral male' },
      { id: 'bella', name: 'Bella', description: 'Bright, energetic female' },
      { id: 'liam', name: 'Liam', description: 'Deep, reassuring male' },
      { id: 'aria', name: 'Aria', description: 'Soft, supportive female' }
    ];
  }

  isSupported(): boolean {
    return !!this.apiKey && typeof fetch !== 'undefined';
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('chess-coach-lemonfox-tts-settings');
      if (saved) {
        const s = JSON.parse(saved);
        this.enabled = s.enabled ?? true;
        this.voice = s.voice ?? 'sarah';
        this.speed = s.speed ?? 1.0;
      }
    } catch {}
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(
        'chess-coach-lemonfox-tts-settings',
        JSON.stringify({ enabled: this.enabled, voice: this.voice, speed: this.speed })
      );
    } catch {}
  }
}

class LemonfoxTTSSession implements TTSSession {
  private requestId: string;
  private apiKey: string;
  private baseUrl: string;
  private enabled: boolean;
  private voice: string;
  private speed: number;
  private onCleanup: () => void;

  private textBuffer = '';
  private processedText = '';
  private audioQueue: HTMLAudioElement[] = [];
  private playingQueue = false;
  private isPlaying = false;
  private stopped = false;
  private currentAudio: HTMLAudioElement | null = null;
  private processTimer: NodeJS.Timeout | null = null;
  private static PROCESS_DELAY = 200;

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

  feed(textChunk: string): void {
    if (!this.enabled || this.stopped) return;
    this.textBuffer += textChunk;
    this.processAvailableSentences();
    if (this.processTimer) clearTimeout(this.processTimer);
    this.processTimer = setTimeout(() => this.processRemainingText(), LemonfoxTTSSession.PROCESS_DELAY);
  }

  stop(reason = 'user_requested'): void {
    if (this.stopped) return;
    this.stopped = true;
    this.textBuffer = '';
    this.processedText = '';
    if (this.processTimer) { clearTimeout(this.processTimer); this.processTimer = null; }
    if (this.currentAudio) { this.currentAudio.pause(); this.currentAudio.currentTime = 0; this.currentAudio = null; }
    for (const a of this.audioQueue) { a.pause(); if (a.src) URL.revokeObjectURL(a.src); }
    this.audioQueue = [];
    this.playingQueue = false;
    this.isPlaying = false;
    console.log(`Lemonfox TTS session ${this.requestId} stopped: ${reason}`);
    this.onCleanup();
  }

  isActive(): boolean {
    return !this.stopped && (this.isPlaying || this.playingQueue || this.textBuffer.length > 0 || this.audioQueue.length > 0);
  }

  private processAvailableSentences(): void {
    if (this.stopped) return;
    const unprocessed = this.textBuffer.slice(this.processedText.length);
    const sentenceRegex = /[.!?]+(?:\s|$)|(?:\n\s*){2,}/g;
    let m: RegExpExecArray | null;
    let lastIdx = 0;
    while ((m = sentenceRegex.exec(unprocessed)) !== null) {
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx > 0) {
      const complete = unprocessed.slice(0, lastIdx).trim();
      const cleaned = this.cleanTextForTts(complete);
      this.processedText += unprocessed.slice(0, lastIdx);
      if (cleaned) this.generateAudioForText(cleaned);
    }
  }

  private async processRemainingText(): Promise<void> {
    if (this.stopped) return;
    const remaining = this.textBuffer.slice(this.processedText.length).trim();
    if (remaining) {
      const cleaned = this.cleanTextForTts(remaining);
      this.processedText = this.textBuffer;
      if (cleaned) await this.generateAudioForText(cleaned);
    }
  }

  private async generateAudioForText(text: string): Promise<void> {
    if (this.stopped || !text.trim()) return;
    try {
      const blob = await this.generateAudioChunk(text);
      if (blob && !this.stopped) {
        const audio = await this.createAudioElement(blob);
        this.audioQueue.push(audio);
        if (!this.playingQueue) this.playAudioQueue();
      }
    } catch (e) {
      console.warn('Failed to generate Lemonfox TTS audio:', e);
    }
  }

  private async createAudioElement(audioBlob: Blob): Promise<HTMLAudioElement> {
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    audio.volume = 0.8;
    audio.preload = 'auto';
    const cleanup = () => URL.revokeObjectURL(url);
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);
    return audio;
  }

  private async playAudioQueue(): Promise<void> {
    if (this.playingQueue || this.stopped) return;
    this.playingQueue = true;
    while (this.audioQueue.length > 0 && !this.stopped) {
      const audio = this.audioQueue.shift()!;
      try { this.currentAudio = audio; this.isPlaying = true; await this.playAudio(audio); }
      catch (e) { console.warn('Lemonfox audio playback failed:', e); }
      finally { this.currentAudio = null; this.isPlaying = false; }
    }
    this.playingQueue = false;
  }

  private playAudio(audio: HTMLAudioElement): Promise<void> {
    return new Promise((resolve, reject) => {
      const onEnded = () => { audio.removeEventListener('ended', onEnded); audio.removeEventListener('error', onError); resolve(); };
      const onError = () => { audio.removeEventListener('ended', onEnded); audio.removeEventListener('error', onError); reject(new Error('Audio play failed')); };
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      audio.play().catch(reject);
    });
  }

  private async generateAudioChunk(text: string): Promise<Blob | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          voice: this.voice,
          response_format: 'mp3',
          speed: this.speed
        })
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(`Lemonfox API error ${resp.status}: ${t}`);
      }
      return await resp.blob();
    } catch (e) {
      console.warn('Lemonfox TTS chunk generation failed:', e);
      return null;
    }
  }
}

export function createLemonfoxTTSAdapter(): LemonfoxTTSAdapter | null {
  const key = getLemonfoxApiKey();
  if (!key) return null;
  return new LemonfoxTTSAdapter(key);
}

function getLemonfoxApiKey(): string | null {
  if (typeof window !== 'undefined') {
    const k = localStorage.getItem('chess-coach-lemonfox-api-key');
    if (k) return k;
  }
  const envKey = import.meta.env.VITE_LEMONFOX_API_KEY as string | undefined;
  return envKey || null;
}

