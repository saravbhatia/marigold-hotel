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
  const audioRef = useRef<HTMLAudioElement>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
          setIsProcessing(true);  // Start processing animation
          const response = await fetch('/api/chat', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Failed to process audio');
          }

          const data = await response.json();
          
          // Add user's transcribed message
          if (data.userMessage) {
            setMessages(prev => [...prev, { role: 'user', content: data.userMessage }]);
          }

          // Add assistant's response and play audio
          if (data.assistantMessage) {
            setMessages(prev => [...prev, { role: 'assistant', content: data.assistantMessage }]);
            if (data.audioResponse) {
              setIsSpeaking(true);
              const audio = new Audio(`data:audio/mp3;base64,${data.audioResponse}`);
              audio.onended = () => setIsSpeaking(false);
              await audio.play();
            }
          }
        } catch (error) {
          console.error('Error processing audio:', error);
        } finally {
          setIsProcessing(false);  // Stop processing animation
        }
      };

      mediaRecorder.start();
      setIsListening(true);

      // Set up silence detection
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
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