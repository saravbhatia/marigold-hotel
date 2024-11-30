'use client'

import { useState, useEffect } from 'react';

interface Response {
  text: string;
  rating: number;
}

interface ScenarioProps {
  onResponseSelect?: (rating: number) => void;
}

export default function Scenario({ onResponseSelect }: ScenarioProps) {
  const [responses, setResponses] = useState<Response[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResponses();
  }, []);

  const fetchResponses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: "Guest is calling about extending their stay by two nights but is concerned about the rate."
        }),
      });

      const data = await res.json();
      console.log('API Response:', data);
      setResponses(data.responses || []);
    } catch (error) {
      console.error('Failed to fetch responses:', error);
      setResponses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResponseSelect = (index: number) => {
    setSelectedResponse(index);
    if (onResponseSelect) {
      onResponseSelect(responses[index].rating);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 p-4 rounded-lg">
        <h3 className="font-semibold text-orange-800">Current Call</h3>
        <p className="text-gray-700 mt-2">Guest wants to extend stay by 2 nights but is concerned about the rate</p>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-orange-800">Choose your response:</h4>
        {responses.map((response, index) => (
          <button
            key={index}
            onClick={() => handleResponseSelect(index)}
            className={`w-full text-left p-4 rounded-lg border transition-colors duration-200 ${
              selectedResponse === index
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-orange-300'
            }`}
          >
            <p>{response.text}</p>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <span>Response Rating: {response.rating}/5</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
} 