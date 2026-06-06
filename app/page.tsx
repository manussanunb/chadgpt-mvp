"use client";

import { useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { ChatInput } from "@/components/ChatInput";
import type { ChatResponse } from "@/engine/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { category: string; source_url: string }[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "เกิดข้อผิดพลาด");
      }

      const data: ChatResponse = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex flex-col h-screen bg-gray-50 max-w-2xl mx-auto">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
          ช
        </div>
        <div>
          <h1 className="font-semibold text-gray-800 text-sm">ChadGPT</h1>
          <p className="text-xs text-gray-400">นโยบายและผลงานของชัชชาติ</p>
        </div>
      </header>

      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        onStarterClick={sendMessage}
      />

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => sendMessage(input)}
        isLoading={isLoading}
      />
    </main>
  );
}
