import { useState, useEffect } from 'react';
import { ttsAdapter } from '@/services/tts-adapter';

interface TTSSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TTSSettings({ isOpen, onClose }: TTSSettingsProps) {
  const [enabled, setEnabled] = useState(true);
  const [rate, setRate] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [provider, setProvider] = useState<string>('web-speech');
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [providersMeta, setProvidersMeta] = useState<Array<{ id: string; name: string; apiKeyStorageKey?: string; apiKeyLabel?: string; apiKeyPlaceholder?: string; }>>([]);
  const [voices, setVoices] = useState<any[]>([]);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const current = (ttsAdapter as any).getProvider();
      setProvider(current);
      setAvailability((ttsAdapter as any).getProviderAvailability());
      setVoices(ttsAdapter.getVoices());
      const metaList = (ttsAdapter as any).getProvidersMeta?.() ?? [];
      setProvidersMeta(metaList);
      const meta = metaList.find((m: any) => m.id === current);
      const key = meta?.apiKeyStorageKey ? localStorage.getItem(meta.apiKeyStorageKey) : '';
      setApiKey(key || '');
    }
  }, [isOpen]);

  const handleEnableToggle = (checked: boolean) => {
    setEnabled(checked);
    ttsAdapter.setEnabled(checked);
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    ttsAdapter.setRate(newRate);
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    ttsAdapter.setVoice(voiceId);
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    const meta = providersMeta.find(p => p.id === provider);
    if (meta?.apiKeyStorageKey) {
      if (key.trim()) {
        localStorage.setItem(meta.apiKeyStorageKey, key.trim());
        (ttsAdapter as any).reinitialize();
        setAvailability((ttsAdapter as any).getProviderAvailability());
        setVoices(ttsAdapter.getVoices());
      } else {
        localStorage.removeItem(meta.apiKeyStorageKey);
        setAvailability((ttsAdapter as any).getProviderAvailability());
        setVoices([]);
      }
    }
  };

  const handleProviderChange = (next: string) => {
    (ttsAdapter as any).setProvider(next);
    setProvider(next);
    const meta = providersMeta.find(p => p.id === next);
    const key = meta?.apiKeyStorageKey ? localStorage.getItem(meta.apiKeyStorageKey) : '';
    setApiKey(key || '');
    setVoices(ttsAdapter.getVoices());
  };

  const testTTS = () => {
    const session = ttsAdapter.begin('test');
    session.feed('Testing chess coach voice. Good move!');
    setTimeout(() => {
      if (session.isActive()) {
        setTimeout(() => session.stop('test_complete'), 2000);
      } else {
        session.stop('test_complete');
      }
    }, 5000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
        style={{ background: 'var(--color-canvas)', color: 'var(--color-text)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Text-to-Speech Settings</h2>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-70"
            aria-label="Close"
          >
            A-
          </button>
        </div>

        <div className="space-y-4">
          {/* Enable/Disable TTS */}
          <div className="flex items-center justify-between">
            <label className="font-medium">Enable Speech</label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleEnableToggle(e.target.checked)}
              className="w-4 h-4"
            />
          </div>

          {/* Provider selection */}
          <div className="space-y-2">
            <label className="block font-medium">TTS Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
            >
              {providersMeta.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{(availability as any)[p.id] ? '' : ' (not configured)'}
                </option>
              ))}
            </select>
          </div>

          {/* API Configuration */}
          <div className="space-y-2">
            {(() => {
              const meta = providersMeta.find(p => p.id === provider);
              if (meta?.apiKeyStorageKey) {
                return (
                  <>
                    <label className="block font-medium">{meta.apiKeyLabel || 'API Key'}</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder={meta.apiKeyPlaceholder || ''}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                    />
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      {(availability as any)[provider] ? 'Using selected TTS provider' : 'Add API key to enable this provider'}
                    </p>
                  </>
                );
              }
              return null;
            })()}
            {provider === 'web-speech' && (
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Browser TTS uses your system voices and requires no API key.
              </p>
            )}
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="block font-medium">Voice</label>
            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
            >
              <option value="">Default</option>
              {voices.map((voice, index) => (
                <option key={voice.id || index} value={voice.id || voice.voiceURI}>
                  {voice.name} {voice.description && `- ${voice.description}`}
                </option>
              ))}
            </select>
          </div>

          {/* Speech Rate */}
          <div className="space-y-2">
            <label className="block font-medium">
              Speech Rate: {rate.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.25"
              max="4.0"
              step="0.1"
              value={rate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Test Button */}
          <button
            onClick={testTTS}
            disabled={!enabled || !(availability as any)[provider]}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
          >
            {(availability as any)[provider] ? 'Test Voice' : 'Add API Key to Enable TTS'}
          </button>

          {/* Help Text */}
          <div className="text-xs space-y-1" style={{ color: 'var(--color-muted)' }}>
            <p><strong>Notes:</strong> OpenAI and Lemonfox offer very natural voices; Google provides many voices. Browser TTS quality varies by system.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
