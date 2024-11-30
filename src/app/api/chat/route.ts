import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `You are a customer service agent at the Marigold Hotel in Jaipur, India. 
You should provide 3 possible response options that a customer service agent could choose from when responding to a guest.
Each response should be professional, helpful, and reflect the warm hospitality of the Marigold Hotel.
Format your response as a JSON array of 3 objects, each with a 'text' and 'rating' property.
The rating should indicate how good this response option is (1-5).`;

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      model: "gpt-3.5-turbo",
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    return NextResponse.json(JSON.parse(completion.choices[0].message.content || '{"responses": []}'));
  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate responses' },
      { status: 500 }
    );
  }
} 