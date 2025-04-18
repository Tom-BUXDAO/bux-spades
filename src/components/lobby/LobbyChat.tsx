"use client";

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import Image from 'next/image';

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

  // Setup socket event handlers
  useEffect(() => {
    if (!activeSocket || handlersSetupRef.current) return;

    console.log('Setting up socket event handlers for chat');
    handlersSetupRef.current = true;
    socketRef.current = activeSocket;
    
    const onConnect = () => {
      console.log('Lobby chat connected');
      setIsConnected(true);
      setError(null);
      
      // Join the lobby room
      activeSocket.emit('join_lobby', { userId, userName });
    };
    
    const onDisconnect = (reason: string) => {
      console.log('Lobby chat disconnected:', reason);
      setIsConnected(false);
      handlersSetupRef.current = false;
    };
    
    const onError = (err: any) => {
      console.error('Lobby chat error:', err);
      setError(err.message || 'Connection error');
      setIsConnected(false);
      handlersSetupRef.current = false;
    };

    const onOnlineUsersUpdate = (count: number) => {
      setOnlineUsers(count);
    };

    const onUserJoined = (data: { userId: string; userName: string }) => {
      try {
        const systemMessage: ChatMessage = {
          id: `system-${Date.now()}-${Math.random()}`,
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
          id: `system-${Date.now()}-${Math.random()}`,
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
          chatMessage.id = `${Date.now()}-${chatMessage.userId || 'system'}-${Math.random().toString(36).substr(2, 9)}`;
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
      console.log('Socket already connected, joining lobby');
      setIsConnected(true);
      activeSocket.emit('join_lobby', { userId, userName });
    }

    return () => {
      console.log('Cleaning up socket event handlers');
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
    };
  }, [activeSocket, userId, userName]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeSocket) return;

    const chatMessage: ChatMessage = {
      userId,
      userName,
      message: message.trim(),
      timestamp: Date.now()
    };

    activeSocket.emit('lobby_message', chatMessage);
    setMessage('');
    setShowEmojiPicker(false);
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
        <h3 className="text-white font-bold" style={{ fontSize: `${mobileHeaderFontSize}px` }}>Game Chat</h3>
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
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={screenSize.width < 640 ? "Type..." : "Type a message..."}
            className="bg-gray-700 text-white rounded-l px-3 py-2 flex-1 outline-none border-0"
          />
          <button
            type="submit"
            disabled={!isConnected}
            className={`bg-blue-600 text-white rounded-r hover:bg-blue-700 flex items-center justify-center w-10 ${
              !isConnected && 'opacity-50 cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute right-2 -top-8 text-xl text-yellow-300 hover:text-yellow-200"
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
      </form>
    </div>
  );
} 