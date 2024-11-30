'use client'

import { useState } from 'react';
import { motion } from 'framer-motion';
import CallSimulator from '@/components/CallSimulator';

export default function Home() {
  const [isCallActive, setIsCallActive] = useState(false);

  return (
    <main className="min-h-screen p-8">
      {!isCallActive ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-4xl mx-auto text-center"
        >
          <h1 className="text-5xl font-bold text-orange-900 mb-6 tracking-wide
            drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]
            px-4 py-2
            bg-white/30 backdrop-blur-sm
            rounded-lg
            ring-2 ring-orange-200
            text-shadow-sm">
            Welcome to The Marigold Hotel
          </h1>
          <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-orange-300">
            <p className="text-lg mb-6 text-orange-700">
              Experience the art of hospitality as a customer service agent at the prestigious Marigold Hotel in Jaipur.
            </p>
            <button
              onClick={() => setIsCallActive(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-full text-lg font-semibold transition-colors duration-300"
            >
              Take an Incoming Call
            </button>
          </div>
        </motion.div>
      ) : (
        <CallSimulator onCallEnd={() => setIsCallActive(false)} />
      )}
    </main>
  );
}