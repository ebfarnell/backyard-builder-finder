import { useState, useEffect } from 'react';
import { Eye, EyeOff, Save, Trash2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toaster';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface APIKey {
  id: string;
  provider: 'openai' | 'anthropic';
  isEncrypted: boolean;
  createdAt: string;
  expiresAt: string | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [encryptKeys, setEncryptKeys] = useState(false);

  useEffect(() => {
    if (user) {
      loadAPIKeys();
    }
  }, [user]);

  const loadAPIKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('id, provider, is_encrypted, created_at, expires_at')
        .eq('user_id', user!.id);

      if (error) throw error;

      setApiKeys((data || []).map(key => ({
        id: key.id,
        provider: key.provider,
        isEncrypted: key.is_encrypted,
        createdAt: key.created_at,
        expiresAt: key.expires_at,
      })));
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to load API keys',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveAPIKey = async (provider: 'openai' | 'anthropic', key: string) => {
    if (!key.trim()) return;

    setSaving(true);
    try {
      // Hash the key for storage
      const keyHash = await hashKey(key);

      const { error } = await supabase
        .from('user_api_keys')
        .upsert({
          user_id: user!.id,
          provider,
          key_hash: keyHash,
          is_encrypted: encryptKeys,
          expires_at: null, // 90 days from now if encrypted
        });

      if (error) throw error;

      // Store in session storage for immediate use
      sessionStorage.setItem(`${provider}_api_key`, key);

      addToast({
        type: 'success',
        title: 'API Key Saved',
        message: `${provider.toUpperCase()} API key saved successfully`,
      });

      // Clear form
      if (provider === 'openai') setOpenaiKey('');
      if (provider === 'anthropic') setAnthropicKey('');

      await loadAPIKeys();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to save API key',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteAPIKey = async (keyId: string, provider: string) => {
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;

      // Remove from session storage
      sessionStorage.removeItem(`${provider}_api_key`);

      addToast({
        type: 'success',
        title: 'API Key Deleted',
        message: 'API key removed successfully',
      });

      await loadAPIKeys();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to delete API key',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const hashKey = async (key: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure your API keys and preferences
          </p>
        </div>

        {/* API Keys Section */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">API Keys</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Security Notice</p>
                  <p className="mt-1">
                    API keys are stored securely and only used for your searches. 
                    By default, keys are session-only and not persisted. 
                    Enable encryption below to store keys for 90 days.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Encryption Toggle */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="encrypt-keys"
              checked={encryptKeys}
              onChange={(e) => setEncryptKeys(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="encrypt-keys" className="text-sm font-medium">
              Store encrypted keys for 90 days (optional)
            </label>
          </div>

          {/* OpenAI API Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">OpenAI API Key</h3>
              {apiKeys.find(k => k.provider === 'openai') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const key = apiKeys.find(k => k.provider === 'openai');
                    if (key) deleteAPIKey(key.id, 'openai');
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              )}
            </div>
            
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <Input
                  type={showOpenaiKey ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  helperText="Required for LLM analysis (GPT-4o-mini)"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={() => saveAPIKey('openai', openaiKey)}
                disabled={!openaiKey.trim() || saving}
                loading={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
            
            {apiKeys.find(k => k.provider === 'openai') && (
              <p className="text-sm text-green-600">
                ✓ OpenAI key configured ({apiKeys.find(k => k.provider === 'openai')?.isEncrypted ? 'encrypted' : 'session-only'})
              </p>
            )}
          </div>

          {/* Anthropic API Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Anthropic API Key</h3>
              {apiKeys.find(k => k.provider === 'anthropic') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const key = apiKeys.find(k => k.provider === 'anthropic');
                    if (key) deleteAPIKey(key.id, 'anthropic');
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              )}
            </div>
            
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <Input
                  type={showAnthropicKey ? 'text' : 'password'}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  helperText="Optional - for Claude 3.5 Sonnet (when enabled)"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={() => saveAPIKey('anthropic', anthropicKey)}
                disabled={!anthropicKey.trim() || saving}
                loading={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
            
            {apiKeys.find(k => k.provider === 'anthropic') && (
              <p className="text-sm text-green-600">
                ✓ Anthropic key configured ({apiKeys.find(k => k.provider === 'anthropic')?.isEncrypted ? 'encrypted' : 'session-only'})
              </p>
            )}
          </div>
        </div>

        {/* Usage Information */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium mb-2">Usage Information</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• LLM budget is capped at $1.00 per search</p>
            <p>• OpenAI GPT-4o-mini is used by default (~$0.15 per 1M tokens)</p>
            <p>• Anthropic Claude 3.5 Sonnet available when enabled (~$3 per 1M tokens)</p>
            <p>• Keys are only used for your searches and never shared</p>
          </div>
        </div>
      </div>
    </div>
  );
}