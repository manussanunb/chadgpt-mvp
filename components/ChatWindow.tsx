"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { MessageBubble } from "./MessageBubble";

interface Source {
  category: string;
  source_url: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  citationSources?: Record<string, { category: string; source_url: string }>;
  followUpQuestions?: string[] | null;
}

const STARTER_QUESTIONS = [
  "4 ปีที่ผ่านมากทม.ทำอะไรด้านสุขภาพไปแล้วบ้าง?",
  "นโยบายด้านการศึกษามีอะไรบ้าง?",
  "แก้ปัญหารถติดยังไง?",
  "นโยบายด้านสิ่งแวดล้อมมีอะไรบ้าง?",
  "อกหักทำไงดี?",
];

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  onStarterClick: (question: string) => void;
  onFollowUpSelect: (question: string) => void;
}

export function ChatWindow({ messages, isLoading, onStarterClick, onFollowUpSelect }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const lastAssistantIdx = messages.reduce(
    (last, msg, i) => (msg.role === "assistant" ? i : last),
    -1
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-0">
      <div className="w-full max-w-3xl mx-auto lg:px-6">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-2">
          <div>
            <p className="text-base text-[#013920] font-semibold mb-1">สวัสดี! 👋</p>
            <h2 className="text-2xl font-bold text-[#013920] mb-2">ถาม ChadGPT ได้เลย</h2>
            <p className="text-sm text-gray-400">
              ข้อมูลนโยบายและผลงานของกรุงเทพมหานครฯ 4 ปีที่ผ่านมา
            </p>
          </div>
          <div className="flex flex-col gap-2.5 w-full max-w-lg">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => {
                  posthog.capture("starter_question_clicked", { question: q });
                  onStarterClick(q);
                }}
                className="group text-left px-4 py-3.5 rounded-2xl border border-[#013920]/15 text-sm text-gray-600 bg-[#f8fffe] shadow-sm hover:bg-[#013920] hover:border-[#013920] hover:text-white hover:shadow-lg transition-all duration-200 flex items-center justify-between gap-2"
              >
                <span>{q}</span>
                <span className="text-[#86f101] opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-base leading-none flex-shrink-0">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <MessageBubble
          key={i}
          message={msg}
          isLatest={i === lastAssistantIdx}
          isLoading={isLoading}
          onFollowUpSelect={onFollowUpSelect}
        />
      ))}

      {isLoading && (
        <div className="flex justify-start mb-3">
          <div className="bg-[#f8fffe] border-l-[3px] border-l-[#013920] border border-[#013920]/10 rounded-2xl rounded-bl-sm px-5 py-3.5 shadow-sm">
            <span className="flex gap-1.5 items-center">
              <span className="w-2 h-2 bg-[#013920] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-[#013920] rounded-full animate-bounce" style={{ animationDelay: "160ms" }} />
              <span className="w-2 h-2 bg-[#013920] rounded-full animate-bounce" style={{ animationDelay: "320ms" }} />
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
      </div>
    </div>
  );
}
