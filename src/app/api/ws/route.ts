import { WebSocket } from 'ws';

let ws: WebSocket | null = null;
let isSessionCreated = false;
let isConnecting = false;
let responseQueue: any[] = [];  // Queue to store responses

export async function GET(req: Request) {
  // If already connecting, wait for the connection
  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return new Response(JSON.stringify({ 
      isSessionCreated, 
      responses: responseQueue 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // If no connection exists or connection is closed, create a new one
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    isConnecting = true;
    try {
      const url = new URL('wss://api.openai.com/v1/realtime');
      url.searchParams.set('model', 'gpt-4o-realtime-preview-2024-10-01');

      ws = new WebSocket(url.toString(), {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        ws!.onopen = () => {
          console.log('WebSocket connection opened, readyState:', ws?.readyState);
          clearTimeout(timeout);
          resolve();
        };

        ws!.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });

      ws.onmessage = (event) => {
        if (!ws) return;
        
        let response;
        try {
          response = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          console.log('Message received from OpenAI:', response);

          if (response.type === 'session.created') {
            console.log('Session created, ready to send messages');
            isSessionCreated = true;

            // Update session with concise instructions
            const updateMessage = {
              type: 'session.update',
              session: {
                instructions: 'You are a Marigold Hotel customer service agent. Be concise and direct in your responses. Keep your answers brief but helpful.'
              }
            };
            ws.send(JSON.stringify(updateMessage));
            console.log('Sent session update for concise responses');
          } else if (response.type === 'response.audio.delta' || response.type === 'response.audio.done') {
            // Add response to queue
            responseQueue.push(response);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error details:', {
          message: error.message,
          type: error.type,
          error
        });
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed with code:', event.code, 'reason:', event.reason);
        ws = null;
        isSessionCreated = false;
        isConnecting = false;
        responseQueue = [];  // Clear queue on disconnect
      };

    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      isConnecting = false;
      ws = null;
      return new Response(JSON.stringify({ error: 'Failed to establish WebSocket connection' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    } finally {
      isConnecting = false;
    }
  }

  // Return current state and all pending responses
  const response = { 
    isSessionCreated, 
    responses: responseQueue 
  };
  responseQueue = [];  // Clear queue after sending
  return new Response(JSON.stringify(response), { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(req: Request) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !isSessionCreated) {
    return new Response('WebSocket not connected or session not created', { status: 503 });
  }

  try {
    const data = await req.json();
   // console.log('Sending message:', data);
    ws.send(JSON.stringify(data));
    return new Response('Message sent', { status: 200 });
  } catch (error) {
    console.error('Error sending message:', error);
    return new Response('Error sending message', { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('Closing WebSocket connection on user request');
    ws.close();
    ws = null;
    isSessionCreated = false;
    return new Response('WebSocket connection closed', { status: 200 });
  }
  return new Response('No active WebSocket connection', { status: 200 });
} 