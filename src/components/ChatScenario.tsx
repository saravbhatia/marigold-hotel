'use client'

import React, { useState, useRef, useEffect } from 'react';

interface ChatScenarioProps {
  onCallEnd: () => void;
}

export default function ChatScenario({ onCallEnd }: ChatScenarioProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
    };

    // Add listener for first interaction
    const handleInteraction = () => {
      initAudioContext();
      document.removeEventListener('click', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    return () => {
      document.removeEventListener('click', handleInteraction);
    };
  }, []);

  const playAudioResponse = async (base64Audio: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      setIsSpeaking(true);
      const audioContext = audioContextRef.current;
      
      // Convert base64 to array buffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      source.onended = () => {
        setIsSpeaking(false);
      };

      source.start(0);
    } catch (error) {
      console.error('Error playing audio response:', error);
      setIsSpeaking(false);
    }
  };

  const startListening = async () => {
    try {
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      // Resume audio context if it exists
      if (audioContextRef.current) {
        await audioContextRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,  // Standard WAV sample rate
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Received audio chunk:', {
            size: event.data.size,
            type: event.data.type
          });
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped, processing chunks:', chunksRef.current.length);
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        console.log('Created audio blob:', {
          size: audioBlob.size,
          type: audioBlob.type
        });
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
          setIsProcessing(true);
          const response = await fetch('/api/chat', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Failed to process audio');
          }

          const data = await response.json();
          
          if (data.userMessage) {
            setMessages(prev => [...prev, { role: 'user', content: data.userMessage }]);
          }

          if (data.assistantMessage) {
            setMessages(prev => [...prev, { role: 'assistant', content: data.assistantMessage }]);
            if (data.audioResponse) {
              await playAudioResponse(data.audioResponse);
            }
          }
        } catch (error) {
          console.error('Error processing audio:', error);
        } finally {
          setIsProcessing(false);
        }
      };

      // Start recording with timeslice for all browsers
      mediaRecorder.start(1000); // 1-second chunks for all browsers
      setIsListening(true);

      // Set up silence detection
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const analyser = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyser);
      
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkSilence = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        
        if (average < 10) { // Silence threshold
          if (!silenceTimeoutRef.current) {
            silenceTimeoutRef.current = setTimeout(() => {
              if (mediaRecorderRef.current?.state === 'recording') {
                stopListening();
              }
            }, 1500); // 1.5 seconds of silence
          }
        } else {
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
        }
        requestAnimationFrame(checkSilence);
      };

      requestAnimationFrame(checkSilence);
    } catch (error) {
      console.error('Error starting audio:', error);
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    setIsListening(false);
  };

  return (
    <div className="flex flex-col h-[80vh] max-w-3xl mx-auto">
      <div className="bg-orange-50 p-4 rounded-lg mb-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="font-semibold text-orange-800">Active Call</h3>
            <p className="text-gray-700">Speaking with Marigold Hotel about Jaipur tourism</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onCallEnd}
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
          {isListening && !isSpeaking && !isProcessing && (
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

          {/* Processing Animation */}
          {isProcessing && (
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="flex gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 bg-yellow-500 rounded-full"
                    style={{ 
                      animation: 'processing 1.4s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Speaking Animation */}
          {isSpeaking && (
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
              <div className="flex items-center gap-1">
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
              <p className="text-sm text-gray-500 mt-2">Speaking...</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes processing {
          0%, 100% { 
            transform: scale(0.8);
            opacity: 0.5;
          }
          50% { 
            transform: scale(1.2);
            opacity: 1;
          }
        }
      `}</style>

      <button
        onClick={isListening ? stopListening : startListening}
        className={`w-full p-4 rounded-lg mb-4 text-white font-medium transition-colors ${
          isListening
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
        disabled={isProcessing}
      >
        {isProcessing ? 'Processing...' : isListening ? 'Stop Speaking' : 'Start Speaking'}
      </button>
    </div>
  );
} 