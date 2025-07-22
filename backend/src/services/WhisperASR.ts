import { OpenAI } from 'openai';
import { ASRService, ErrorResponse } from '../types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * OpenAI Whisper ASR service implementation
 * Handles audio transcription using OpenAI Whisper API
 */
export class WhisperASR implements ASRService {
  private client: OpenAI;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // ms
  private model: string = 'whisper-1';

  constructor(apiKey?: string) {
    // Use provided API key or get from environment variables
    const key = apiKey || process.env.OPENAI_API_KEY;
    
    if (!key) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it to the constructor.');
    }
    
    this.client = new OpenAI({
      apiKey: key
    });
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   * @param audioBlob Audio data as Buffer
   * @returns Transcribed text
   */
  async transcribeAudio(audioBlob: Buffer): Promise<string> {
    let attempts = 0;
    
    while (attempts < this.maxRetries) {
      try {
        return await this.callWhisperAPI(audioBlob);
      } catch (error: any) {
        attempts++;
        console.error(`Whisper API error (attempt ${attempts}/${this.maxRetries}):`, error.message);
        
        // If we've reached max retries, throw the error
        if (attempts >= this.maxRetries) {
          throw this.formatError(error);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempts));
      }
    }
    
    // This should never be reached due to the throw in the loop
    throw new Error('Failed to transcribe audio after multiple attempts');
  }

  /**
   * Call OpenAI Whisper API
   */
  private async callWhisperAPI(audioBlob: Buffer): Promise<string> {
    // Validate audio blob
    if (!audioBlob || audioBlob.length === 0) {
      throw new Error('Audio blob is empty or invalid');
    }

    // Check audio size (Whisper has a 25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioBlob.length > maxSize) {
      throw new Error(`Audio file too large: ${audioBlob.length} bytes (max: ${maxSize} bytes)`);
    }

    // Start timing for performance tracking
    const startTime = Date.now();
    
    try {
      // Create a File-like object from the buffer
      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      
      // Call Whisper API
      const response = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: this.model,
        language: 'ru', // Russian language
        response_format: 'text',
        temperature: 0.2
      });
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      console.log(`Whisper transcription completed in ${processingTime}ms`);
      
      // Validate response
      if (!response || typeof response !== 'string') {
        throw new Error('Invalid response from Whisper API');
      }
      
      const transcription = response.trim();
      
      if (!transcription) {
        throw new Error('Empty transcription from Whisper API');
      }
      
      return transcription;
    } catch (error: any) {
      // Handle specific OpenAI API errors
      if (error.status) {
        switch (error.status) {
          case 400:
            throw new Error('Invalid audio format or corrupted audio file');
          case 413:
            throw new Error('Audio file too large for Whisper API');
          case 429:
            throw new Error('Rate limit exceeded for Whisper API');
          case 500:
          case 502:
          case 503:
            throw new Error('Whisper API server error, please try again');
          default:
            throw new Error(`Whisper API error: ${error.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Check if Whisper ASR is available
   * @returns true if API key is configured
   */
  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Format error for consistent error handling
   */
  private formatError(error: any): Error {
    const errorResponse: ErrorResponse = {
      type: 'ASR_ERROR',
      message: error.message || 'Unknown error occurred during audio transcription',
      details: error.response?.data || error,
      timestamp: new Date()
    };
    
    return new Error(JSON.stringify(errorResponse));
  }

  /**
   * Configure retry settings
   */
  configureRetries(maxRetries: number, retryDelay: number): void {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Set Whisper model to use
   */
  setModel(model: string): void {
    this.model = model;
  }
}