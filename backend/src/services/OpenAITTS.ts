import { TTSService, TTSOptions } from '../types';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class OpenAITTS implements TTSService {
  private apiKey: string;
  private baseURL: string = 'https://api.openai.com/v1';
  private audioDir: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey !== undefined ? apiKey : (process.env.OPENAI_API_KEY || '');
    
    // Create audio directory if it doesn't exist
    this.audioDir = path.join(process.cwd(), 'temp', 'audio');
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  async synthesizeSpeech(text: string, options: TTSOptions = { voice: 'alloy', speed: 1.0, pitch: 1.0 }): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI TTS service not available - missing API key');
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/audio/speech`,
        {
          model: 'tts-1',
          input: text,
          voice: this.mapVoice(options.voice),
          speed: Math.max(0.25, Math.min(4.0, options.speed)) // OpenAI speed range
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      // Save audio to temporary file
      const audioId = uuidv4();
      const audioPath = path.join(this.audioDir, `${audioId}.mp3`);
      
      fs.writeFileSync(audioPath, response.data);

      // Return URL path that can be served by the web server
      return `/api/audio/${audioId}.mp3`;
    } catch (error) {
      console.error('OpenAI TTS error:', error);
      throw new Error(`TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Map generic voice names to OpenAI voice names
   */
  private mapVoice(voice: string): string {
    const voiceMap: Record<string, string> = {
      'alloy': 'alloy',
      'echo': 'echo',
      'fable': 'fable',
      'onyx': 'onyx',
      'nova': 'nova',
      'shimmer': 'shimmer',
      'default': 'alloy',
      'male': 'onyx',
      'female': 'nova'
    };

    return voiceMap[voice.toLowerCase()] || 'alloy';
  }

  /**
   * Clean up old audio files
   */
  cleanupOldFiles(maxAgeMinutes: number = 60): number {
    const cutoffTime = Date.now() - maxAgeMinutes * 60 * 1000;
    let cleanedCount = 0;

    try {
      const files = fs.readdirSync(this.audioDir);
      
      for (const file of files) {
        const filePath = path.join(this.audioDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
    } catch (error) {
      console.error('Error cleaning up audio files:', error);
    }

    return cleanedCount;
  }

  /**
   * Get audio file path for serving
   */
  getAudioFilePath(audioId: string): string {
    return path.join(this.audioDir, `${audioId}.mp3`);
  }
}