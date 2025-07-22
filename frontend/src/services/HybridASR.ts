import type { ASRService } from '@/types';
import { WebSpeechASR } from './WebSpeechASR';
import { debounce } from '@/utils/debounce';
import { compressAudio, AudioCompressionOptions } from '@/utils/audioOptimization';

/**
 * Hybrid ASR service that uses Web Speech API as primary and Whisper API as fallback
 */
export class HybridASR implements ASRService {
  private webSpeechASR: WebSpeechASR;
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private resolveRecording: ((result: string) => void) | null = null;
  private rejectRecording: ((error: Error) => void) | null = null;
  private compressionOptions: AudioCompressionOptions;
  private debouncedProcessResult: (result: string) => void;

  public onResult?: (result: string) => void;
  public onError?: (error: Error) => void;

  constructor(compressionOptions: AudioCompressionOptions = {}) {
    this.webSpeechASR = new WebSpeechASR();
    this.compressionOptions = {
      quality: 0.7,
      maxSizeKB: 500,
      format: 'webm',
      ...compressionOptions
    };
    
    // Debounce result processing to avoid rapid-fire results
    this.debouncedProcessResult = debounce((result: string) => {
      if (this.onResult) {
        this.onResult(result);
      }
      
      if (this.resolveRecording) {
        this.resolveRecording(result);
        this.resolveRecording = null;
        this.rejectRecording = null;
      }
    }, 300); // 300ms debounce
    
    this.setupWebSpeechHandlers();
  }

  private setupWebSpeechHandlers(): void {
    this.webSpeechASR.onResult = (result: string) => {
      // Use debounced processing to avoid rapid-fire results
      this.debouncedProcessResult(result);
    };

    this.webSpeechASR.onError = async (error: Error) => {
      console.warn('Web Speech API failed, attempting Whisper fallback:', error.message);
      
      // Try Whisper fallback if we have recorded audio
      if (this.audioChunks.length > 0) {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const result = await this.transcribeWithWhisper(audioBlob);
          
          // Use debounced processing for consistency
          this.debouncedProcessResult(result);
          return;
        } catch (whisperError) {
          console.error('Whisper fallback also failed:', whisperError);
          // Fall through to original error handling
        }
      }
      
      if (this.onError) {
        this.onError(error);
      }
      
      if (this.rejectRecording) {
        this.rejectRecording(error);
        this.resolveRecording = null;
        this.rejectRecording = null;
      }
    };
  }

  /**
   * Check if any ASR method is available
   */
  public isAvailable(): boolean {
    return this.webSpeechASR.isAvailable() || this.isMediaRecorderAvailable();
  }

  /**
   * Check if MediaRecorder is available for Whisper fallback
   */
  private isMediaRecorderAvailable(): boolean {
    return typeof MediaRecorder !== 'undefined' && 
           typeof MediaRecorder.isTypeSupported === 'function' &&
           MediaRecorder.isTypeSupported('audio/webm');
  }

  /**
   * Start recording with both Web Speech API and MediaRecorder for fallback
   */
  public async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording is already in progress');
    }

    this.isRecording = true;
    this.audioChunks = [];

    // Start MediaRecorder for Whisper fallback
    if (this.isMediaRecorderAvailable()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          // Stop all tracks to release microphone
          stream.getTracks().forEach(track => track.stop());
        };

        this.mediaRecorder.start();
      } catch (error) {
        console.warn('Failed to start MediaRecorder for fallback:', error);
        // Don't throw here, continue with Web Speech API only
      }
    }

    // Try Web Speech API first
    if (this.webSpeechASR.isAvailable()) {
      try {
        await this.webSpeechASR.startRecording();
      } catch (error) {
        console.warn('Failed to start Web Speech API:', error);
        // Continue with just MediaRecorder
      }
    }

    // If neither is available, throw error
    if (!this.webSpeechASR.isAvailable() && !this.isMediaRecorderAvailable()) {
      this.isRecording = false;
      throw new Error('No ASR method is available');
    }
  }

  /**
   * Stop recording and get transcription
   */
  public async stopRecording(): Promise<string> {
    if (!this.isRecording) {
      throw new Error('No recording in progress');
    }

    this.isRecording = false;

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    return new Promise((resolve, reject) => {
      this.resolveRecording = resolve;
      this.rejectRecording = reject;
      
      // Set timeout for recording
      setTimeout(() => {
        if (this.rejectRecording) {
          this.rejectRecording(new Error('Recording timeout'));
          this.resolveRecording = null;
          this.rejectRecording = null;
        }
      }, 15000); // Longer timeout for Whisper processing

      // Try to stop Web Speech API first
      if (this.webSpeechASR.getRecordingState()) {
        this.webSpeechASR.stopRecording().catch((error) => {
          console.warn('Web Speech API stop failed:', error);
          // The error handler will trigger Whisper fallback
        });
      } else {
        // If Web Speech API wasn't recording, try Whisper directly
        setTimeout(() => {
          if (this.audioChunks.length > 0) {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            this.transcribeWithWhisper(audioBlob)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error('No audio data recorded'));
          }
        }, 100); // Small delay to allow MediaRecorder to finish
      }
    });
  }

  /**
   * Transcribe audio blob using Whisper API
   */
  public async transcribeAudio(audioBlob: Blob): Promise<string> {
    return this.transcribeWithWhisper(audioBlob);
  }

  /**
   * Internal method to call Whisper API
   */
  private async transcribeWithWhisper(audioBlob: Blob): Promise<string> {
    if (audioBlob.size === 0) {
      throw new Error('Audio blob is empty');
    }

    // Compress audio before sending to reduce bandwidth and processing time
    const compressedBlob = await compressAudio(audioBlob, this.compressionOptions);
    
    console.log(`Audio compression: ${audioBlob.size} bytes -> ${compressedBlob.size} bytes (${Math.round((1 - compressedBlob.size / audioBlob.size) * 100)}% reduction)`);

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('audio', compressedBlob, 'recording.webm');
    formData.append('startTime', Date.now().toString());

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.transcription) {
        throw new Error('No transcription received from server');
      }

      return data.transcription;
    } catch (error: any) {
      console.error('Whisper API transcription failed:', error);
      throw new Error(`Whisper transcription failed: ${error.message}`);
    }
  }

  /**
   * Get current recording state
   */
  public getRecordingState(): boolean {
    return this.isRecording;
  }

  /**
   * Get information about available ASR methods
   */
  public getAvailableMethods(): { webSpeech: boolean; whisper: boolean } {
    return {
      webSpeech: this.webSpeechASR.isAvailable(),
      whisper: this.isMediaRecorderAvailable()
    };
  }
}