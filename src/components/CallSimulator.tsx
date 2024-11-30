'use client'

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PhoneIcon, StarIcon } from '@heroicons/react/24/solid';
import Scenario from '@/components/Scenario';

interface CallSimulatorProps {
  onCallEnd: () => void;
}

export default function CallSimulator({ onCallEnd }: CallSimulatorProps) {
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [customerRating, setCustomerRating] = useState(0);
  const [businessRating, setBusinessRating] = useState(0);

  const handleEndCall = () => {
    setIsCallEnded(true);
    // Simulate ratings
    setCustomerRating(Math.floor(Math.random() * 5) + 1);
    setBusinessRating(Math.floor(Math.random() * 5) + 1);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto"
    >
      {!isCallEnded ? (
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-orange-800">Active Call</h2>
            <PhoneIcon className="h-8 w-8 text-green-500 animate-pulse" />
          </div>
          <Scenario />
          <button
            onClick={handleEndCall}
            className="mt-6 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full"
          >
            End Call
          </button>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold text-orange-800 mb-6">Call Complete</h2>
          <div className="space-y-4">
            <div>
              <p className="text-lg mb-2">Customer Satisfaction Rating:</p>
              <div className="flex justify-center">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`h-8 w-8 ${
                      i < customerRating ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-lg mb-2">Business Value Rating:</p>
              <div className="flex justify-center">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`text-2xl ${
                      i < businessRating ? 'text-green-500' : 'text-gray-300'
                    }`}
                  >
                    $
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={onCallEnd}
            className="mt-8 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full"
          >
            Return to Home
          </button>
        </div>
      )}
    </motion.div>
  );
} 