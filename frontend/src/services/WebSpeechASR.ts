import type { ASRService } from '@/types';

// Web Speech API type declarations
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

export class WebSpeechASR implements ASRService {
  private recognition: SpeechRecognition | null = null;
  private isRecording = false;
  private resolveRecording: ((result: string) => void) | null = null;
  private rejectRecording: ((error: Error) => void) | null = null;

  public onResult?: (result: string) => void;
  public onError?: (error: Error) => void;

  constructor() {
    this.initializeRecognition();
  }

  private initializeRecognition(): void {
    if (!this.isAvailable()) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'ru-RU';
    this.recognition.maxAlternatives = 1;

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[0][0].transcript;
      
      if (this.onResult) {
        this.onResult(result);
      }
      
      if (this.resolveRecording) {
        this.resolveRecording(result);
        this.resolveRecording = null;
        this.rejectRecording = null;
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const error = new Error(`Speech recognition error: ${event.error}`);
      
      if (this.onError) {
        this.onError(error);
      }
      
      if (this.rejectRecording) {
        this.rejectRecording(error);
        this.resolveRecording = null;
        this.rejectRecording = null;
      }
    };

    this.recognition.onstart = () => {
      this.isRecording = true;
    };

    this.recognition.onend = () => {
      this.isRecording = false;
    };
  }

  public isAvailable(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  public async startRecording(): Promise<void> {
    if (!this.recognition || !this.isAvailable()) {
      throw new Error('Speech recognition is not available');
    }

    if (this.isRecording) {
      throw new Error('Recording is already in progress');
    }

    this.recognition.start();
  }

  public async stopRecording(): Promise<string> {
    if (!this.recognition || !this.isRecording) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve, reject) => {
      this.resolveRecording = resolve;
      this.rejectRecording = reject;
      
      setTimeout(() => {
        if (this.rejectRecording) {
          this.rejectRecording(new Error('Recording timeout'));
          this.resolveRecording = null;
          this.rejectRecording = null;
        }
      }, 10000);

      this.recognition!.stop();
    });
  }

  public async transcribeAudio(_audioBlob: Blob): Promise<string> {
    throw new Error('Web Speech API does not support blob transcription. Use startRecording/stopRecording instead.');
  }

  public getRecordingState(): boolean {
    return this.isRecording;
  }
}