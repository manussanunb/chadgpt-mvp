"use client";

import { useState } from "react";
import Image from "next/image";
import { ChatWindow } from "@/components/ChatWindow";
import { ChatInput } from "@/components/ChatInput";
import type { ChatResponse } from "@/engine/types";
import logoSrc from "../public/teamchadchart_logo.png";
import avatarSrc from "../public/chadgpt_profile_picture.jpeg";

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
    <main className="flex flex-col h-screen bg-[#ffffff] max-w-2xl mx-auto md:border-x md:border-[#013920]">
      <header className="flex items-center gap-3 px-4 py-3 bg-[#013920]">
        <Image src={avatarSrc} alt="ChadGPT" className="w-9 h-9 rounded-full object-cover ring-2 ring-[#86f101]/40" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">ChadGPT</p>
          <p className="text-xs text-white/50 leading-tight truncate">นโยบายและผลงานของทีมชัชชาติ</p>
        </div>
        <Image src={logoSrc} alt="TeamChadchart" className="h-6 w-auto opacity-70 flex-shrink-0" />
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
