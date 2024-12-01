'use client'

import React, { useState, useRef, useEffect } from 'react';

const animationStyles = `
  @keyframes sound-wave {
    0% {
      height: 4px;
    }
    50% {
      height: 16px;
    }
    100% {
      height: 4px;
    }
  }
`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface WebSocketResponse {
  type: string;
  event_id: string;
  session?: {
    id: string;
    object: string;
    model: string;
    expires_at: number;
    modalities: string[];
    instructions: string;
    voice: string;
  };
  item?: {
    id: string;
    content: Array<{ type: string; text: string; }>;
  };
  response?: {
    text: string;
    audio?: string;
  };
}

interface ScenarioProps {
  onCallEnd: () => void;
}

export default function Scenario({ onCallEnd }: ScenarioProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnectedToAgent, setIsConnectedToAgent] = useState(false);
  const [isPolling, setIsPolling] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioChunksRef = useRef<string[]>([]);
  const currentResponseRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioQueueRef = useRef<string[]>([]);
  const isProcessingChunkRef = useRef(false);

  const playAccumulatedAudio = async (chunks: string[]) => {
    try {
      const base64Audio = chunks.join('');
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create AudioContext for playback
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const audioBuffer = audioContext.createBuffer(1, bytes.length / 2, 24000);
      const channelData = audioBuffer.getChannelData(0);

      // Convert PCM16 to float32
      const pcm16 = new Int16Array(bytes.buffer);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();

      // Cleanup when done
      source.onended = () => {
        audioContext.close();
      };
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  useEffect(() => {
    // Start polling immediately when component mounts
    setIsPolling(true);
    
    if (!isPolling) return;  // Skip if polling is disabled

    const initWebSocket = async () => {
      try {
        const response = await fetch('/api/ws');
        if (!response.ok) {
          throw new Error('Failed to initialize WebSocket');
        }
        const data = await response.json();
        if (data.isSessionCreated) {
          console.log('Session is already created');
          setIsConnectedToAgent(true);
        }
        if (data.responses && data.responses.length > 0) {
          data.responses.forEach(handleAudioResponse);
        }
      } catch (error) {
        console.error('WebSocket initialization error:', error);
      }
    };

    initWebSocket();

    const pollInterval = setInterval(async () => {
      if (!isPolling) return;  // Skip if polling is disabled
      try {
        const response = await fetch('/api/ws');
        const data = await response.json();
        
        if (data.isSessionCreated && !isConnectedToAgent) {
          console.log('Session created detected through polling');
          setIsConnectedToAgent(true);
        }

        if (data.responses && data.responses.length > 0) {
          data.responses.forEach(handleAudioResponse);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 1000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isConnectedToAgent, isPolling]);

  const playNextChunk = async () => {
    if (isPlayingAudio || audioQueueRef.current.length === 0 || isProcessingChunkRef.current) return;
    
    isProcessingChunkRef.current = true;
    try {
      const chunk = audioQueueRef.current.shift()!;
      setIsPlayingAudio(true);

      // Convert base64 to PCM data
      const binaryString = atob(chunk);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create AudioContext for playback
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const audioBuffer = audioContext.createBuffer(1, bytes.length / 2, 24000);
      const channelData = audioBuffer.getChannelData(0);

      // Convert PCM16 to float32
      const pcm16 = new Int16Array(bytes.buffer);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        audioContext.close();
        setIsPlayingAudio(false);
        isProcessingChunkRef.current = false;
        // Process next chunk if available
        playNextChunk();
      };
      source.start();
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      setIsPlayingAudio(false);
      isProcessingChunkRef.current = false;
    }
  };

  const handleAudioResponse = (response: any) => {
    if (response.type === 'response.audio.delta') {
      // If this is a new response, clear previous chunks
      if (currentResponseRef.current !== response.response_id) {
        audioQueueRef.current = [];
        currentResponseRef.current = response.response_id;
      }
      // Add the chunk to queue and try to play
      audioQueueRef.current.push(response.delta);
      playNextChunk();
    } else if (response.type === 'response.audio.done') {
      // Just clear the current response ID when done
      if (currentResponseRef.current === response.response_id) {
        currentResponseRef.current = null;
      }
    }
  };

  const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  const base64EncodeAudio = (float32Array: Float32Array): string => {
    const arrayBuffer = floatTo16BitPCM(float32Array);
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000; // 32KB chunk size
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  };

  const handleAudioData = async (audioData: Float32Array) => {
    try {
      const base64Audio = base64EncodeAudio(audioData);
      console.log('Sending audio chunk, length:', base64Audio.length);
      
      const response = await fetch('/api/ws', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64Audio
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send audio data');
      }
      console.log('Successfully sent audio chunk');
    } catch (error) {
      console.error('Error sending audio:', error);
    }
  };

  const stopListening = () => {
    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
    setIsSpeaking(false);
  };

  const startListening = async () => {
    try {
      console.log('Starting audio capture...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;  // Store stream reference
      
      // Set up audio analysis
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Create and load the audio worklet
      await audioContextRef.current.audioWorklet.addModule(
        URL.createObjectURL(new Blob([`
          class AudioProcessor extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0][0];
              if (input) {
                this.port.postMessage({ audioData: input });
              }
              return true;
            }
          }
          registerProcessor('audio-processor', AudioProcessor);
        `], { type: 'application/javascript' }))
      );

      const workletNode = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
      source.connect(workletNode);
      workletNode.connect(audioContextRef.current.destination);
      
      workletNode.port.onmessage = (event) => {
        const { audioData } = event.data;
        handleAudioData(audioData);
      };

      console.log('Audio capture setup complete');
      setIsListening(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const handleAudioChunk = async () => {
    if (chunksRef.current.length === 0) return;

    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];

    try {
      const formData = new FormData();
      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      formData.append('audio', audioFile);

      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.text.trim()) {
        setMessages(prev => [...prev, 
          { role: 'assistant', content: data.text }
        ]);
        await playAudioResponse(data.audio);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  };

  const playAudioResponse = async (audioBase64: string) => {
    if (audioRef.current) {
      try {
        // Convert base64 to blob
        const response = await fetch(`data:audio/mp3;base64,${audioBase64}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        audioRef.current.src = url;
        await audioRef.current.play();
        
        // Clean up the URL after playing
        audioRef.current.onended = () => {
          URL.revokeObjectURL(url);
        };
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  };

  const endCall = async () => {
    // 1. Stop new operations first
    setIsPolling(false);  // Prevent new polling
    setIsEnding(true);    // Prevent new audio sends
    
    try {
      console.log('Ending call, cleaning up...');
      
      // 2. Small delay for any in-flight audio
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 3. Stop audio capture
      stopListening();
      
      // 4. Clear audio state
      audioChunksRef.current = [];
      currentResponseRef.current = null;
      
      // 5. Close WebSocket connection
      try {
        const response = await fetch('/api/ws', { method: 'DELETE' });
        if (!response.ok) {
          throw new Error('Failed to close WebSocket connection');
        }
      } catch (error) {
        // Silently handle WebSocket closure errors
      }
      
      // 6. Reset UI state
      setIsConnectedToAgent(false);
      onCallEnd();
    } catch (error) {
      // Log error but continue cleanup
      console.error('Error during cleanup:', error);
    } finally {
      // 7. Always reset ending state
      setIsEnding(false);
    }
  };

  return (
    <div className="flex flex-col h-[80vh] max-w-3xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      <div className="bg-orange-50 p-4 rounded-lg mb-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="font-semibold text-orange-800">Active Call</h3>
            <p className="text-gray-700">Speaking with Marigold Hotel about Jaipur tourism</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Connected to Agent</span>
          </div>
          <button
            onClick={endCall}
            className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            End Call
          </button>
        </div>
      </div>

      {/* Agent Visualization */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative">
          {/* Agent Avatar */}
          <div className="w-24 h-24 rounded-full bg-orange-100 border-2 border-orange-300 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
          
          {/* Listening Animation */}
          {isListening && !isSpeaking && (
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="flex gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Speaking Animation */}
          {isSpeaking && (
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-orange-500 rounded-full animate-sound-wave"
                    style={{
                      height: '16px',
                      animation: 'sound-wave 0.5s ease-in-out infinite',
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2 text-center">Speaking...</p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={isListening ? stopListening : startListening}
        className={`w-full p-4 rounded-lg mb-4 text-white font-medium transition-colors ${
          isListening
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isListening ? 'Stop Speaking' : 'Start Speaking'}
      </button>
    </div>
  );
} 