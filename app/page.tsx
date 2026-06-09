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
      <header className="flex items-center gap-3 px-4 py-3 bg-[#013920] border-b border-[#013920]">
        <Image src={avatarSrc} alt="ChadGPT" className="w-8 h-8 rounded-full object-cover" />
        <div>
          <Image src={logoSrc} alt="ChadGPT" className="h-5 w-auto rounded" />
          <p className="text-xs text-white/60">นโยบายและผลงานของทีมชัชชาติ</p>
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
