'use client'

import { useState } from 'react';

const scenarios = [
  {
    customerName: "Mrs. Thompson",
    issue: "Room booking modification",
    context: "Guest wants to extend stay by 2 nights but is concerned about the rate",
    responses: [
      {
        text: "I understand you'd like to extend your stay. Let me check our availability and see if I can offer you our best possible rate.",
        rating: 5,
      },
      {
        text: "We can extend your stay, but the rate will be higher for the additional nights.",
        rating: 3,
      },
      {
        text: "Sorry, we're quite busy and extensions are difficult to accommodate.",
        rating: 1,
      },
    ],
  },
  // Add more scenarios here
];

export default function Scenario() {
  const [currentScenario] = useState(scenarios[0]);
  const [selectedResponse, setSelectedResponse] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 p-4 rounded-lg">
        <h3 className="font-semibold text-orange-800">Customer: {currentScenario.customerName}</h3>
        <p className="text-gray-700 mt-2">{currentScenario.issue}</p>
        <p className="text-gray-600 mt-1 text-sm italic">{currentScenario.context}</p>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-orange-800">Choose your response:</h4>
        {currentScenario.responses.map((response, index) => (
          <button
            key={index}
            onClick={() => setSelectedResponse(index)}
            className={`w-full text-left p-4 rounded-lg border transition-colors duration-200 ${
              selectedResponse === index
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-orange-300'
            }`}
          >
            {response.text}
          </button>
        ))}
      </div>
    </div>
  );
} 