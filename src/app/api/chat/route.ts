import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01&authorization=Bearer ${process.env.OPENAI_API_KEY}&openai-beta=realtime=v1`;
let ws: WebSocket | null = null;
let isConnecting = false;
let messageHandlers: ((event: MessageEvent) => void)[] = [];

export async function POST(req: Request) {
  const initWebSocket = async () => {
    if (isConnecting) {
      // Wait for existing connection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      return initWebSocket();
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      isConnecting = true;
      ws = new WebSocket(wsUrl);

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws = null;
            reject(new Error('Connection timeout'));
          }, 5000);

          ws!.onopen = () => {
            clearTimeout(timeout);
            resolve();
          };

          ws!.onerror = (error) => {
            clearTimeout(timeout);
            ws = null;
            reject(error);
          };

          ws!.onmessage = (event) => {
            messageHandlers.forEach(handler => handler(event));
          };
        });
      } finally {
        isConnecting = false;
      }
    }

    return ws;
  };

  try {
    const socket = await initWebSocket();
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const contentType = req.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const { action } = await req.json();
      if (action === 'start') {
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        const handler = (event: MessageEvent) => {
          const response = JSON.parse(event.data);
          if (response.type === 'text') {
            writer.write(response.text).catch(console.error);
          }
        };
        messageHandlers.push(handler);

        socket.send(JSON.stringify({
          type: 'message',
          content: 'START_CONVERSATION'
        }));

        return new Response(stream.readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });
      }
    }

    // Handle audio data
    const formData = await req.formData();
    const audioChunk = formData.get('audio');

    if (!(audioChunk instanceof Blob)) {
      throw new Error('Audio chunk required');
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const handler = (event: MessageEvent) => {
      const response = JSON.parse(event.data);
      if (response.type === 'text') {
        writer.write(response.text)
          .then(() => {
            writer.close();
            messageHandlers = messageHandlers.filter(h => h !== handler);
          })
          .catch(console.error);
      }
    };
    messageHandlers.push(handler);

    socket.send(JSON.stringify({
      type: 'audio',
      data: await audioChunk.arrayBuffer(),
      format: 'webm',
    }));

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { status: 500 });
  }
} 