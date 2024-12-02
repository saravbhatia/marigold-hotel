import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get('audio') as Blob;

    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log('Received audio blob:', {
      type: audioBlob.type,
      size: audioBlob.size
    });

    // Create WAV file
    const audioFile = new File([audioBlob], 'audio.wav', { 
      type: 'audio/wav',
      lastModified: Date.now()
    });

    console.log('Created audio file:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size
    });

    // Convert audio to text using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    // Get the text from the transcription response
    const transcribedText = transcription.text;
    if (!transcribedText) {
      throw new Error('No transcription text received');
    }

    // Get chat completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a Marigold Hotel customer service agent. The Marigold Hotel is a 5-star hotel in Jaipur, India. You are an expert in all things Jaipur. Be concise and direct in your responses. Keep your answers brief but helpful. You have no reservation information and cannot help with booking. Always answer in the language detected in the user\'s message.'
        },
        {
          role: 'user',
          content: transcribedText
        }
      ]
    });

    const assistantMessage = completion.choices[0].message.content;
    if (!assistantMessage) {
      throw new Error('No assistant message received');
    }

    // Convert response to speech
    const speechResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'shimmer',
      input: assistantMessage,
    });

    // Convert audio to base64
    const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());
    const audioBase64 = audioBuffer.toString('base64');

    return NextResponse.json({
      userMessage: transcribedText,
      assistantMessage,
      audioResponse: audioBase64
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Error processing audio' },
      { status: 500 }
    );
  }
} 