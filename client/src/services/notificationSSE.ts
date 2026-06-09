/**
 * Purpose : SSE client for real-time notification updates.
 *           Maintains persistent connection to notification stream endpoint.
 * 
 * Inputs  : JWT token from localStorage.
 * 
 * Output  : Event emitter for notification count updates.
 * 
 * Dependencies: None (vanilla EventSource API)
 */

import {AUTH_TOKEN_KEY} from '../utils/apiClient';

interface SSENotificationEvent {
  event_type: 'count_update' | 'error';
  unread_count: number;
  has_new: boolean;
  timestamp: string;
  message?: string;
}

type NotificationEventHandler = (event: SSENotificationEvent) => void;

class NotificationSSEService {
  private eventSource: EventSource | null = null;
  private listeners: Set<NotificationEventHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  private isManualClose = false;

  /**
   * Purpose : Connect to SSE notification stream.
   * 
   * Inputs  : None (reads token from localStorage)
   * 
   * Output  : void
   * 
   * Example : notificationSSE.connect()
   */
  connect(): void {
    // Don't connect if already connected
    if (this.eventSource?.readyState === EventSource.OPEN) {
      console.log('🔵 SSE already connected - skipping');
      return;
    }

    // Close any existing connection (CONNECTING or CLOSING state)
    if (this.eventSource) {
      console.log('🔌 Closing existing SSE connection before reconnecting...');
      this.eventSource.close();
      this.eventSource = null;
    }

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      console.warn('⚠️ No JWT token found, cannot connect to SSE');
      return;
    }

    try {
      this.isManualClose = false;

      // EventSource doesn't support headers, so we pass token as query param
      const url = `${import.meta.env.VITE_API_BASE_URL}/api/notifications/stream?token=${encodeURIComponent(token)}`;

      console.log('🔌 Connecting to SSE stream...', url.substring(0, 60) + '...');
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('✅ SSE connection established');
        this.reconnectAttempts = 0; // Reset on successful connection
      };

      this.eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data: SSENotificationEvent = JSON.parse(event.data);
          console.log('📨 SSE event received:', data);
          
          // Notify all listeners
          this.listeners.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              console.error('❌ Error in SSE listener:', err);
            }
          });
        } catch (err) {
          console.error('❌ Error parsing SSE event:', err);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        
        // Close the connection
        this.eventSource?.close();
        this.eventSource = null;

        // Attempt reconnection if not manually closed
        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          
          setTimeout(() => {
            this.connect();
          }, this.reconnectDelay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached. SSE disabled.');
        }
      };
    } catch (err) {
      console.error('❌ Failed to create EventSource:', err);
    }
  }

  /**
   * Purpose : Disconnect from SSE stream.
   * 
   * Inputs  : None
   * 
   * Output  : void
   * 
   * Example : notificationSSE.disconnect()
   */
  disconnect(): void {
    this.isManualClose = true;
    
    if (this.eventSource) {
      console.log('🔌 Disconnecting from SSE stream...');
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.reconnectAttempts = 0;
  }

  /**
   * Purpose : Add event listener for notification updates.
   * 
   * Inputs  :   (1) handler : Callback function for SSE events
   * 
   * Output  : Unsubscribe function
   * 
   * Example : const unsubscribe = notificationSSE.addEventListener((event) => {
   *               console.log('Unread count:', event.unread_count);
   *           });
   *           // Later: unsubscribe();
   */
  addEventListener(handler: NotificationEventHandler): () => void {
    this.listeners.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(handler);
    };
  }

  /**
   * Purpose : Get current connection state.
   * 
   * Inputs  : None
   * 
   * Output  : Connection state (CONNECTING=0, OPEN=1, CLOSED=2)
   * 
   * Example : const state = notificationSSE.getReadyState();
   */
  getReadyState(): number {
    return this.eventSource?.readyState ?? EventSource.CLOSED;
  }
}

// Export singleton instance
export const notificationSSE = new NotificationSSEService();
