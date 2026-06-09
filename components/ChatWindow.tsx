"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";

interface Source {
  category: string;
  source_url: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

const STARTER_QUESTIONS = [
  "4 ปีที่ผ่านมากทม.ทำอะไรด้านสุขภาพไปแล้วบ้าง?",
  "นโยบายด้านการศึกษามีอะไรบ้าง?",
  "แก้ปัญหารถติดยังไง?",
  "นโยบายด้านสิ่งแวดล้อมมีอะไรบ้าง?",
];

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  onStarterClick: (question: string) => void;
}

export function ChatWindow({ messages, isLoading, onStarterClick }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
          <div>
            <h2 className="text-xl font-semibold text-[#000000] mb-1">ถาม ChadGPT ได้เลย</h2>
            <p className="text-sm text-gray-400">
              ข้อมูลนโยบายและผลงานของกรุงเทพมหานครฯ 4 ปีที่ผ่านมา
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-sm">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onStarterClick(q)}
                className="text-left px-4 py-3 rounded-xl border border-[#013920]/30 text-sm text-gray-600 hover:bg-[#86f101]/20 hover:border-[#86f101] hover:text-[#013920] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}

      {isLoading && (
        <div className="flex justify-start mb-3">
          <div className="bg-white border border-[#013920]/20 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-[#013920] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-[#013920] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-[#013920] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
