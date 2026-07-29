// src/services/wsTutorService.ts

type MessageCallback = (chunk: string, isDone: boolean) => void;
type ErrorCallback = (error: string) => void;

function getAccessToken(): string | null {
  const raw = sessionStorage.getItem('safescholar.tokens.v1');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.accessToken || null;
  } catch {
    return null;
  }
}

export class WSTutorService {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private onMessage: MessageCallback;
  private onError: ErrorCallback;

  constructor(sessionId: string, onMessage: MessageCallback, onError: ErrorCallback) {
    // Determine WS protocol (ws vs wss) based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_GATEWAY_HOST || window.location.host;
    const token = getAccessToken();
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    this.url = `${protocol}//${host}/api/v1/ai/tutor?session_id=${sessionId}${tokenParam}`;
    this.onMessage = onMessage;
    this.onError = onError;
  }

  public connect(): void {
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          // Handle potential JSON error frames from the backend
          const data = JSON.parse(event.data);
          if (data.error) {
            this.onError(data.error);
            return;
          }
        } catch {
          // Raw text streaming chunk
        }
        this.onMessage(event.data, false);
      };

      this.socket.onerror = () => {
        this.onError('Connection error encountered.');
      };

      this.socket.onclose = (event) => {
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const timeout = Math.pow(2, this.reconnectAttempts) * 1000;
          setTimeout(() => this.connect(), timeout);
        }
      };
    } catch (err) {
      this.onError((err as Error).message);
    }
  }

  public sendPrompt(promptText: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(promptText);
    } else {
      this.onError('Socket connection is closed. Attempting to reconnect...');
      this.connect();
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
  }
}
