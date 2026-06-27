"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import posthog from "posthog-js";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { ChatWindow } from "@/components/ChatWindow";
import { ChatInput } from "@/components/ChatInput";
import type { ChatResponse, FollowUpResponse } from "@/engine/types";
import avatarSrc from "../public/chadgpt_profile_picture.jpg";
import awareHouseSrc from "../public/awarehouse_logo.jpg";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { category: string; source_url: string }[];
  citationSources?: Record<string, { category: string; source_url: string }>;
  followUpQuestions?: string[] | null;
}

const SITE_KEY =
  process.env.NODE_ENV === "development" ? undefined : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const followUpAbortRef = useRef<AbortController | null>(null);

  const turnstileReady = !SITE_KEY || !!turnstileToken;

  async function sendMessage(text: string, isStarterQuestion = false) {
    const trimmed = text.trim();
    if (!trimmed || isLoading || !turnstileReady) return;

    // Cancel any in-flight follow-up request from a previous answer
    followUpAbortRef.current?.abort();
    followUpAbortRef.current = null;

    posthog.capture("message_sent", {
      message_length: trimmed.length,
      is_starter_question: isStarterQuestion,
    });

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsLoading(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (turnstileToken) headers["x-turnstile-token"] = turnstileToken;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: trimmed }),
      });

      turnstileRef.current?.reset();
      setTurnstileToken(null);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "เกิดข้อผิดพลาด");
      }

      const data: ChatResponse = await res.json();
      posthog.capture("chat_response_received", {
        has_sources: data.sources.length > 0,
        source_count: data.sources.length,
      });

      const assistantMsg: Message = {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        citationSources: data.citationSources,
        followUpQuestions: null,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Fire follow-up question generation for every successful response
      const ac = new AbortController();
      followUpAbortRef.current = ac;

      const timeoutId = setTimeout(() => ac.abort(), 5000);

      fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, answer: data.answer, ragContext: data.ragContext }),
        signal: ac.signal,
      })
        .then((r) => r.json())
        .then(({ followUpQuestions }: FollowUpResponse) => {
          clearTimeout(timeoutId);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, followUpQuestions }];
          });
        })
        .catch(() => {
          clearTimeout(timeoutId);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, followUpQuestions: [] }];
          });
        });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
      posthog.capture("chat_error", { error_message: errorMessage });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex flex-col h-screen bg-[#ffffff] max-w-3xl lg:max-w-none mx-auto md:border-x lg:border-x-0 md:border-[#013920]">
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-[#013920] text-white rounded-2xl px-10 py-8 shadow-2xl text-center ring-2 ring-[#86f101]/40">
          <p className="text-2xl font-bold leading-relaxed">ปิดระบบชั่วคราว</p>
          <p className="text-2xl font-bold leading-relaxed">ระหว่างช่วงการเลือกตั้ง</p>
        </div>
      </div>
      <header className="flex items-center gap-3 px-4 py-4 bg-[#013920] shadow-lg border-b-2 border-[#86f101]/30">
        <Image src={avatarSrc} alt="ChadGPT" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover ring-2 ring-[#86f101]/50 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight">ChadGPT</p>
          <p className="text-xs text-white/70 leading-tight truncate">นโยบายและผลงานของทีมชัชชาติ</p>
        </div>
        <Image src={awareHouseSrc} alt="BKK AwareHouse" className="h-10 w-10 md:h-12 md:w-12 rounded-md object-cover flex-shrink-0 ring-2 ring-white/50" />
      </header>

      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        onStarterClick={(q) => sendMessage(q, true)}
        onFollowUpSelect={(q) => sendMessage(q, false)}
      />

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => sendMessage(input)}
        isLoading={isLoading || !turnstileReady}
      />

      {SITE_KEY && (
        <Turnstile
          ref={turnstileRef}
          siteKey={SITE_KEY}
          options={{ appearance: "interaction-only", execution: "render" }}
          onSuccess={setTurnstileToken}
          style={{ display: "none" }}
        />
      )}
    </main>
  );
}
