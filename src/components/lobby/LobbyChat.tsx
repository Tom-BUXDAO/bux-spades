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
  
  useEffect(() => {
    if (!activeSocket) return;
    
    const onConnect = () => {
      console.log('Lobby chat connected');
      setIsConnected(true);
      setError(null);
      
      // Join the lobby room
      activeSocket.emit('join_lobby', { userId, userName });
    };
    
    const onDisconnect = () => {
      console.log('Lobby chat disconnected');
      setIsConnected(false);
    };
    
    const onError = (err: any) => {
      console.error('Lobby chat error:', err);
      setError(err.message || 'Connection error');
    };

    const onOnlineUsersUpdate = (count: number) => {
      setOnlineUsers(count);
    };

    const onUserJoined = (data: { userId: string; userName: string }) => {
      const systemMessage: ChatMessage = {
        id: `system-${Date.now()}-${Math.random()}`,
        userId: 'system',
        userName: 'System',
        message: `${data.userName} joined the lobby`,
        timestamp: Date.now(),
        isSystemMessage: true
      };
      setMessages(prev => [...prev, systemMessage]);
    };

    const onUserLeft = (data: { userId: string; userName: string }) => {
      const systemMessage: ChatMessage = {
        id: `system-${Date.now()}-${Math.random()}`,
        userId: 'system',
        userName: 'System',
        message: `${data.userName} left the lobby`,
        timestamp: Date.now(),
        isSystemMessage: true
      };
      setMessages(prev => [...prev, systemMessage]);
    };
    
    activeSocket.on('connect', onConnect);
    activeSocket.on('disconnect', onDisconnect);
    activeSocket.on('connect_error', onError);
    activeSocket.on('error', onError);
    activeSocket.on('online_users_update', onOnlineUsersUpdate);
    activeSocket.on('user_joined_lobby', onUserJoined);
    activeSocket.on('user_left_lobby', onUserLeft);
    
    setIsConnected(activeSocket.connected);
    
    if (activeSocket.connected) {
      activeSocket.emit('join_lobby', { userId, userName });
    }

    return () => {
      activeSocket.off('connect', onConnect);
      activeSocket.off('disconnect', onDisconnect);
      activeSocket.off('connect_error', onError);
      activeSocket.off('error', onError);
      activeSocket.off('online_users_update', onOnlineUsersUpdate);
      activeSocket.off('user_joined_lobby', onUserJoined);
      activeSocket.off('user_left_lobby', onUserLeft);
    };
  }, [activeSocket, userId, userName]);

  useEffect(() => {
    if (!activeSocket) return;
    
    const handleMessage = (data: any) => {
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
    };
    
    activeSocket.on('lobby_message', handleMessage);
    
    return () => {
      activeSocket.off('lobby_message', handleMessage);
    };
  }, [activeSocket]);

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
    <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex-none h-12 px-3 border-b border-gray-700">
        <div className="flex items-center justify-between h-full">
          <h2 className="text-lg font-semibold text-white">Lobby Chat</h2>
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-300">
                {onlineUsers} online
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex-none p-3 bg-red-900/50 text-red-200">
          <p>{error}</p>
          <button
            onClick={handleRetry}
            className="mt-2 px-3 py-1 bg-red-800 rounded hover:bg-red-700"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-900 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-2 rounded-lg ${
              msg.isSystemMessage 
                ? 'bg-gray-800 text-gray-300' 
                : msg.userId === userId 
                  ? 'bg-blue-900/50 text-white ml-auto' 
                  : 'bg-gray-800 text-white'
            }`}
            style={{ maxWidth: '80%' }}
          >
            <div className="flex items-start space-x-2">
              <Image
                src={msg.isSystemMessage ? BOT_AVATAR : GUEST_AVATAR}
                alt={msg.userName}
                width={24}
                height={24}
                className="rounded-full"
              />
              <div>
                <div className="flex items-baseline space-x-2">
                  <span className="font-medium text-sm">{msg.userName}</span>
                  <span className="text-xs text-gray-400">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-sm break-words">{msg.message}</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex-none px-2 py-2 border-t border-gray-700 bg-gray-800">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex-none w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-100"
          >
            😊
          </button>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-2 py-1.5 bg-gray-700 text-white border-gray-600 rounded-lg placeholder-gray-400 min-w-0"
          />
          <button
            type="submit"
            disabled={!isConnected}
            className={`flex-none w-16 h-8 rounded-lg text-sm ${
              isConnected
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            Send
          </button>
        </div>
        {showEmojiPicker && (
          <div className="absolute bottom-full right-0 mb-2">
            <Picker data={data} onEmojiSelect={onEmojiSelect} theme="dark" />
          </div>
        )}
      </form>
    </div>
  );
} 