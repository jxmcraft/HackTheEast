/**
 * Live Chat Component
 * Per PRD Section 2: Live Chat
 * Allows user to type questions and receive AI-generated responses
 * Responses are both displayed and voiced (TTS)
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Play, Pause, Volume2 } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
  timestamp: number;
}

interface LiveChatProps {
  topic: string;
  section: string;
  personalityPrompt: string;
  onSendMessage?: (message: string) => Promise<string>;
}

export default function LiveChat({
  topic,
  section,
  personalityPrompt,
  onSendMessage,
}: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize with greeting
  useEffect(() => {
    const userName = localStorage.getItem("studybuddy_user");
    let displayName = "Student";
    if (userName) {
      try {
        const { name } = JSON.parse(userName);
        displayName = name;
      } catch (e) {
        console.error("Failed to parse user data:", e);
      }
    }

    const greeting: ChatMessage = {
      id: `greeting-${Date.now()}`,
      role: "assistant",
      content: `Hi ${displayName}! 👋 I'm your AI tutor. Ask me anything about ${topic} - the current topic. I'm here to help you understand the concepts better!`,
      timestamp: Date.now(),
    };
    setMessages([greeting]);
  }, [topic]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Call the provided handler or use a default mock response
      let responseText = "";
      if (onSendMessage) {
        responseText = await onSendMessage(inputValue);
      } else {
        // Mock response for demo purposes
        responseText = await generateMockResponse(inputValue, topic, section, personalityPrompt);
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: responseText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Simulate TTS - in production this would call /api/tts
      // For now, just mark that audio would be available
      assistantMessage.audioUrl = "pending";
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "Sorry, I encountered an error. Please try again or check your internet connection.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = async (messageId: string, content: string) => {
    if (playingAudioId === messageId) {
      setPlayingAudioId(null);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    setPlayingAudioId(messageId);
    try {
      // In production, call /api/tts endpoint
      // For now, simulate with Web Speech API or show placeholder
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => {
        setPlayingAudioId(null);
      };
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("Error playing audio:", error);
      setPlayingAudioId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4">
        <h3 className="text-lg font-semibold">Chat with Your Tutor</h3>
        <p className="text-sm text-purple-100">
          Topic: {topic} • Section: {section}
        </p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-purple-600 text-white rounded-br-none"
                    : "bg-white text-gray-900 border border-gray-200 rounded-bl-none"
                }`}
              >
                <p className="text-sm leading-relaxed break-words">{message.content}</p>

                {/* Audio Controls for Assistant Messages */}
                {message.role === "assistant" && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handlePlayAudio(message.id, message.content)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                        playingAudioId === message.id
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      title="Play audio version"
                    >
                      {playingAudioId === message.id ? (
                        <>
                          <Pause className="w-3 h-3" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          Play
                        </>
                      )}
                    </button>
                    <Volume2 className="w-3 h-3 text-gray-400" />
                  </div>
                )}

                <p className="text-xs mt-1 opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-900 border border-gray-200 px-4 py-3 rounded-lg rounded-bl-none">
              <div className="flex gap-2 items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Tutor is thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me a question..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          💡 Powered by MiniMax abab6.5 • Voice by MiniMax Speech
        </p>
      </div>

      {/* Hidden audio element for TTS */}
      <audio ref={audioRef} />
    </div>
  );
}

/**
 * Mock response generator for demo purposes
 * In production, this would call /api/generate/chat
 */
async function generateMockResponse(
  userMessage: string,
  topic: string,
  section: string,
  personalityPrompt: string
): Promise<string> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Simple mock responses based on keywords
  const lowerMessage = userMessage.toLowerCase();

  const responses: Record<string, string> = {
    neuron: `Great question! A neuron is the fundamental unit of neural networks. It takes multiple inputs, multiplies them by weights, adds a bias, and applies an activation function. Think of it like a decision-making unit that learns over time. The personality prompt says to "${personalityPrompt}", so I'm excited to explain this!`,
    "activation function":
      "Activation functions introduce non-linearity into neural networks. Without them, stacking layers would just create one big linear transformation. ReLU, sigmoid, and tanh are popular choices. Each has its strengths!",
    backpropagation:
      "Backpropagation is how neural networks learn! It uses the chain rule to compute gradients of the loss with respect to each weight, working backwards from the output layer. This lets us efficiently update weights to minimize error.",
    training:
      "Training involves: 1) Forward pass to get predictions, 2) Calculate loss, 3) Backward pass to compute gradients, 4) Update weights. We repeat this multiple times (epochs) until the network converges.",
    loss: "Loss functions measure how wrong the model is. For regression, we use MSE. For classification, we use cross-entropy. Lower loss = better model!",
  };

  // Find a matching response or return a generic one
  for (const [keyword, response] of Object.entries(responses)) {
    if (lowerMessage.includes(keyword)) {
      return response;
    }
  }

  return `That's an interesting question about ${topic}! Could you elaborate on what specifically you'd like to know about ${section}? I'm here to help you understand the concepts deeply!`;
}
