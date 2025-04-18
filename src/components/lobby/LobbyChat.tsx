"use client";

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

interface LobbyChatProps {
  socket: typeof Socket | null;
  userId: string;
  userName: string;
}

interface ChatMessage {
  id?: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  isSystemMessage?: boolean;
}

// Fallback avatars 
const GUEST_AVATAR = "/guest-avatar.png";
const BOT_AVATAR = "/guest-avatar.png";

export default function LobbyChat({ socket, userId, userName }: LobbyChatProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<typeof Socket | null>(null);
  const handlersSetupRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const lastReconnectTimeRef = useRef(0);
  const rateLimitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<Record<string, number>>({});
  const eventTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Add responsive sizing state
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  // Listen for screen size changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Calculate scale factor for responsive sizing
  const getScaleFactor = () => {
    const referenceWidth = 1200;
    let scale = Math.min(1, screenSize.width / referenceWidth);
    return Math.max(0.65, scale);
  };
  
  const scaleFactor = getScaleFactor();
  const fontSize = Math.max(12, Math.floor(14 * scaleFactor));
  const headerFontSize = Math.max(14, Math.floor(18 * scaleFactor));
  const isMobile = screenSize.width < 640;
  const mobileFontSize = isMobile ? 11 : fontSize;
  const mobileHeaderFontSize = isMobile ? 13 : headerFontSize;

  // Only use regular socket if not in test mode
  const regularSocket = !socket ? useSocket() : null;
  const activeSocket = socket || regularSocket?.socket;

  // Rate limit helper function
  const shouldThrottleEvent = (eventName: string, minDelay: number = 2000) => {
    const now = Date.now();
    const lastTime = lastEventTimeRef.current[eventName] || 0;
    
    if (now - lastTime < minDelay) {
      return true;
    }
    
    lastEventTimeRef.current[eventName] = now;
    return false;
  };

  // Debounced emit helper
  const debouncedEmit = (eventName: string, data: any, delay: number = 2000) => {
    if (eventTimeoutsRef.current[eventName]) {
      clearTimeout(eventTimeoutsRef.current[eventName]);
    }

    eventTimeoutsRef.current[eventName] = setTimeout(() => {
      if (activeSocket?.connected) {
        activeSocket.emit(eventName, data);
      }
      delete eventTimeoutsRef.current[eventName];
    }, delay);
  };

  // Setup socket event handlers
  useEffect(() => {
    if (!activeSocket || handlersSetupRef.current) return;

    console.log('Setting up socket event handlers for chat, userId:', userId, 'userName:', userName);
    handlersSetupRef.current = true;
    socketRef.current = activeSocket;
    
    const onConnect = () => {
      console.log('Lobby chat connected for user:', userId);
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
      
      // Clear any existing timeouts
      Object.values(eventTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
      eventTimeoutsRef.current = {};
      
      // Join the lobby room with additional user info - delay to avoid rate limiting
      setTimeout(() => {
        if (!shouldThrottleEvent('join_lobby')) {
          activeSocket.emit('join_lobby', { 
            userId, 
            userName,
            isDiscordUser: /^\d+$/.test(userId),
            timestamp: Date.now()
          });
        }
      }, 500);

      // Request online users count after a delay
      setTimeout(() => {
        if (!shouldThrottleEvent('get_online_users')) {
          activeSocket.emit('get_online_users');
        }
      }, 1500);
    };
    
    const onDisconnect = (reason: string) => {
      console.log('Lobby chat disconnected:', reason, 'for user:', userId);
      setIsConnected(false);
      handlersSetupRef.current = false;

      // Only attempt reconnect if not rate limited
      if (reason === 'transport close' || reason === 'ping timeout') {
        handleReconnect();
      }
    };
    
    const onError = (err: any) => {
      console.error('Lobby chat error for user:', userId, 'error:', err);
      const errorMessage = err.message || 'Connection error';
      
      // Handle rate limiting
      if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
        setError('Too many connection attempts. Please wait a moment...');
        if (rateLimitTimeoutRef.current) {
          clearTimeout(rateLimitTimeoutRef.current);
        }
        rateLimitTimeoutRef.current = setTimeout(() => {
          setError(null);
          handleReconnect();
        }, 5000);
        return;
      }
      
      setError(errorMessage);
      setIsConnected(false);
      handlersSetupRef.current = false;
    };

    const handleReconnect = () => {
      const now = Date.now();
      const timeSinceLastReconnect = now - lastReconnectTimeRef.current;
      
      // Implement exponential backoff
      if (reconnectAttemptsRef.current > 0) {
        const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
        if (timeSinceLastReconnect < backoffTime) {
          console.log(`Waiting ${backoffTime - timeSinceLastReconnect}ms before reconnecting...`);
          return;
        }
      }
      
      reconnectAttemptsRef.current++;
      lastReconnectTimeRef.current = now;
      
      console.log(`Attempting reconnect (${reconnectAttemptsRef.current}/5) for user:`, userId);
      if (reconnectAttemptsRef.current <= 5) {
        activeSocket?.connect();
      } else {
        setError('Unable to connect. Please refresh the page.');
      }
    };

    const onOnlineUsersUpdate = (count: number) => {
      console.log('Online users update:', count, 'for user:', userId);
      setOnlineUsers(count);
      // If we get a count but aren't marked as connected, fix that
      if (count > 0 && !isConnected) {
        setIsConnected(true);
        setError(null);
      }
    };

    const onUserJoined = (data: { userId: string; userName: string }) => {
      try {
        const systemMessage: ChatMessage = {
          id: uuidv4(),
          userId: 'system',
          userName: 'System',
          message: `${data.userName} joined the lobby`,
          timestamp: Date.now(),
          isSystemMessage: true
        };
        setMessages(prev => [...prev, systemMessage]);
      } catch (err) {
        console.error('Error handling user joined:', err);
      }
    };

    const onUserLeft = (data: { userId: string; userName: string }) => {
      try {
        const systemMessage: ChatMessage = {
          id: uuidv4(),
          userId: 'system',
          userName: 'System',
          message: `${data.userName} left the lobby`,
          timestamp: Date.now(),
          isSystemMessage: true
        };
        setMessages(prev => [...prev, systemMessage]);
      } catch (err) {
        console.error('Error handling user left:', err);
      }
    };

    const handleMessage = (data: any) => {
      try {
        console.log('Received lobby chat message:', data);
        
        let chatMessage: ChatMessage;
        
        if (data.message && typeof data.message === 'object') {
          chatMessage = data.message;
        } else if (data.userId) {
          chatMessage = data;
        } else {
          console.error('Unrecognized chat message format:', data);
          return;
        }
        
        if (!chatMessage.id) {
          chatMessage.id = uuidv4();
        }
        
        if (!chatMessage.timestamp) {
          chatMessage.timestamp = Date.now();
        }
        
        setMessages(prev => {
          // Prevent duplicate messages
          if (prev.some(m => m.id === chatMessage.id)) {
            return prev;
          }
          return [...prev, chatMessage].slice(-100); // Keep last 100 messages
        });
      } catch (err) {
        console.error('Error handling chat message:', err);
      }
    };
    
    // Set up event listeners
    activeSocket.on('connect', onConnect);
    activeSocket.on('disconnect', onDisconnect);
    activeSocket.on('connect_error', onError);
    activeSocket.on('error', onError);
    activeSocket.on('online_users_update', onOnlineUsersUpdate);
    activeSocket.on('user_joined_lobby', onUserJoined);
    activeSocket.on('user_left_lobby', onUserLeft);
    activeSocket.on('lobby_message', handleMessage);
    
    // Set initial connection state and join lobby if connected
    if (activeSocket.connected) {
      console.log('Socket already connected, joining lobby for user:', userId);
      setIsConnected(true);
      activeSocket.emit('join_lobby', { 
        userId, 
        userName,
        isDiscordUser: /^\d+$/.test(userId),
        timestamp: Date.now()
      });
      
      // Request online users count after a short delay
      setTimeout(() => {
        activeSocket.emit('get_online_users');
      }, 1000);
    }

    return () => {
      console.log('Cleaning up socket event handlers for user:', userId);
      // Clear all timeouts
      Object.values(eventTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
      eventTimeoutsRef.current = {};
      if (rateLimitTimeoutRef.current) {
        clearTimeout(rateLimitTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.off('connect', onConnect);
        socketRef.current.off('disconnect', onDisconnect);
        socketRef.current.off('connect_error', onError);
        socketRef.current.off('error', onError);
        socketRef.current.off('online_users_update', onOnlineUsersUpdate);
        socketRef.current.off('user_joined_lobby', onUserJoined);
        socketRef.current.off('user_left_lobby', onUserLeft);
        socketRef.current.off('lobby_message', handleMessage);
      }
      handlersSetupRef.current = false;
      lastEventTimeRef.current = {};
    };
  }, [activeSocket, userId, userName]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (!activeSocket?.connected) {
      console.log('Socket not connected, attempting to reconnect...');
      if (!shouldThrottleEvent('reconnect', 5000)) {
        activeSocket?.connect();
      }
      return;
    }

    const chatMessage: ChatMessage = {
      userId,
      userName,
      message: message.trim(),
      timestamp: Date.now()
    };

    // Use debounced emit for chat messages
    if (!shouldThrottleEvent('lobby_message', 500)) {
      console.log('Sending lobby message:', chatMessage);
      activeSocket.emit('lobby_message', chatMessage);
      
      // Add message locally for immediate feedback with same ID format as server
      const localId = uuidv4();
      setMessages(prev => [...prev, { ...chatMessage, id: localId }]);
      setMessage('');
      setShowEmojiPicker(false);
    }
  };

  const onEmojiSelect = (emoji: any) => {
    setMessage(prev => prev + emoji.native);
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleRetry = () => {
    if (activeSocket) {
      activeSocket.connect();
    }
  };

  const getMessageClass = (msg: ChatMessage) => {
    if (msg.isSystemMessage) return 'bg-gray-100 text-gray-600';
    return msg.userId === userId ? 'bg-blue-100' : 'bg-white';
  };

  return (
    <div className="flex flex-col h-full bg-[#1a202c] overflow-hidden border-l border-gray-600">
      {/* Header */}
      <div className="bg-gray-900 p-2 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold" style={{ fontSize: `${mobileHeaderFontSize}px` }}>Game Chat</h3>
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-300">
              {onlineUsers} online
            </span>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex-none p-3 bg-red-900/50 text-red-200 border-b border-red-900/30">
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="mt-2 px-3 py-1 bg-red-800 text-red-100 rounded hover:bg-red-700"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 bg-[#1a202c] min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-2 p-2 rounded-lg ${
              msg.isSystemMessage 
                ? 'bg-gray-800/50 text-gray-300 mx-auto text-center' 
                : msg.userId === userId 
                  ? 'bg-blue-600 text-white ml-auto' 
                  : 'bg-gray-700 text-white'
            }`}
            style={{ maxWidth: '80%' }}
          >
            <div className="flex items-start space-x-2">
              {!msg.isSystemMessage && (
                <Image
                  src={msg.isSystemMessage ? BOT_AVATAR : GUEST_AVATAR}
                  alt={msg.userName}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <div className={msg.isSystemMessage ? 'w-full' : ''}>
                {!msg.isSystemMessage && (
                  <div className="flex items-baseline space-x-2">
                    <span className="font-medium text-sm">{msg.userName}</span>
                    <span className="text-xs text-gray-400">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                )}
                <p className={`mt-1 text-sm break-words ${msg.isSystemMessage ? 'italic' : ''}`}>{msg.message}</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-2 bg-gray-900 border-t border-gray-600">
        <div className="flex">
          <div className="relative flex-1">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={screenSize.width < 640 ? "Type..." : "Type a message..."}
              className="bg-gray-700 text-white rounded-l w-full px-3 py-2 outline-none border-0"
            />
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xl text-yellow-300 hover:text-yellow-200"
            >
              😊
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-10">
                <Picker 
                  data={data} 
                  onEmojiSelect={onEmojiSelect}
                  theme="dark"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!isConnected}
            className={`bg-blue-600 text-white rounded-r hover:bg-blue-700 flex items-center justify-center px-3 ${
              !isConnected && 'opacity-50 cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
} 