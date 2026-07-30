// src/services/wsTutorService.ts

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
type MessageCallback = (chunk: string, isDone: boolean) => void;
type ErrorCallback = (error: string) => void;
type StateCallback = (state: ConnectionState) => void;

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
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 16000;
  private reconnectTimeoutId: any = null;
  private state: ConnectionState = 'disconnected';
  private isExplicitlyClosed = false;

  private onMessage: MessageCallback;
  private onError: ErrorCallback;
  private onStateChange: StateCallback;

  constructor(
    sessionId: string,
    onMessage: MessageCallback,
    onError: ErrorCallback,
    onStateChange: StateCallback
  ) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_GATEWAY_HOST || window.location.host;
    const token = getAccessToken();
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    this.url = `${protocol}//${host}/api/v1/ai/tutor?session_id=${sessionId}${tokenParam}`;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onStateChange = onStateChange;
  }

  private updateState(newState: ConnectionState) {
    this.state = newState;
    this.onStateChange(newState);
  }

  public connect(): void {
    if (this.socket) {
      this.disconnect();
    }

    this.isExplicitlyClosed = false;
    this.updateState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.updateState('connected');
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
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
        // Details hidden for security, pass up generic error
        this.onError('Secure WebSocket connection failed.');
      };

      this.socket.onclose = (event: CloseEvent) => {
        this.cleanupSocket();

        if (this.isExplicitlyClosed) {
          this.updateState('disconnected');
          return;
        }

        let errorMsg = 'WebSocket connection closed.';
        if (event.code === 1006) {
          errorMsg = 'Connection refused or security handshake failed (invalid token/certificates).';
        } else if (event.code === 4401) {
          errorMsg = 'Session expired or authentication failed.';
        } else if (event.code === 4403) {
          errorMsg = 'Access forbidden.';
        } else if (event.reason) {
          errorMsg = `Connection closed: ${event.reason}`;
        }

        this.onError(errorMsg);

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(
            this.maxReconnectDelay,
            Math.pow(2, this.reconnectAttempts) * this.baseReconnectDelay + Math.random() * 500
          );
          
          this.updateState('reconnecting');
          this.reconnectTimeoutId = setTimeout(() => this.connect(), delay);
        } else {
          this.updateState('disconnected');
          this.onError('Max connection attempts reached. Please refresh or verify your credentials.');
        }
      };
    } catch (err) {
      this.updateState('disconnected');
      this.onError((err as Error).message);
    }
  }

  public sendPrompt(promptText: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(promptText);
    } else {
      this.onError('Cannot send message: Socket is not connected.');
    }
  }

  private cleanupSocket(): void {
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket = null;
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.cleanupSocket();
    }
    this.updateState('disconnected');
  }
}
