"use client";

import { useRef, useState } from "react";
import posthog from "posthog-js";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

interface Source {
  category: string;
  source_url: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  citationSources?: Record<string, { category: string; source_url: string }>;
}

function applyInlineCitations(
  raw: string,
  citationSources: Record<string, { category: string; source_url: string }> | undefined
): string {
  if (!citationSources) return raw;
  return raw.replace(/\[cite:(\d+)\]([\s\S]*?)\[\/cite\]/g, (_, id, text) => {
    const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<u data-cite="${id}">${safe}</u>`;
  });
}

function CitationSpan({
  children,
  source,
}: {
  children: React.ReactNode;
  source: { category: string; source_url: string };
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  return (
    <span className="relative inline">
      <span
        className="underline decoration-dotted decoration-[#013920] underline-offset-2 cursor-help text-[#013920]/80"
        onMouseEnter={() => { cancelClose(); setOpen(true); }}
        onMouseLeave={scheduleClose}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </span>
      {open && (
        <span
          className="absolute bottom-full left-0 mb-1 z-10 w-max max-w-[220px] rounded-lg bg-[#013920] text-white text-xs px-3 py-2 shadow-lg flex flex-col gap-1 pointer-events-auto"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <span className="font-medium">{source.category}</span>
          <a
            href={source.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline opacity-80 hover:opacity-100"
          >
            อ่านเพิ่มเติม →
          </a>
        </span>
      )}
    </span>
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [rating, setRating] = useState<"good" | "bad" | "funny" | null>(null);

  function handleRating(value: "good" | "bad" | "funny") {
    if (rating) return;
    setRating(value);
    posthog.capture("answer_rated", { rating: value });
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-gradient-to-br from-[#013920] to-[#024f2d] text-white rounded-br-sm whitespace-pre-wrap shadow-md"
              : "bg-[#f8fffe] border-l-[3px] border-l-[#013920] border border-[#013920]/10 text-gray-800 rounded-bl-sm shadow-sm prose prose-sm max-w-none"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                a: ({ href, children }) => {
                  const safe = href && /^https?:\/\//i.test(href) ? href : undefined;
                  return (
                    <a href={safe} target="_blank" rel="noopener noreferrer" className="text-[#013920] underline decoration-dotted underline-offset-2">
                      {children}
                    </a>
                  );
                },
                u: ({ children, ...props }) => {
                  const citeId = (props as Record<string, unknown>)["data-cite"] as string | undefined;
                  const source = citeId ? message.citationSources?.[citeId] : undefined;
                  if (!source) return <u>{children}</u>;
                  return <CitationSpan source={source}>{children}</CitationSpan>;
                },
              }}
            >
              {applyInlineCitations(message.content, message.citationSources)}
            </ReactMarkdown>
          )}
        </div>

        {!isUser && (
          <div className="flex gap-2 px-1">
            <button
              onClick={() => handleRating("good")}
              disabled={!!rating}
              className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-base transition-all duration-150 ${rating === "good" ? "opacity-100 bg-[#86f101]/20" : rating ? "opacity-20" : "opacity-40 hover:opacity-90 hover:bg-gray-100"}`}
              aria-label="ตอบดี"
            >
              👍
            </button>
            <button
              onClick={() => handleRating("bad")}
              disabled={!!rating}
              className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-base transition-all duration-150 ${rating === "bad" ? "opacity-100 bg-red-50" : rating ? "opacity-20" : "opacity-40 hover:opacity-90 hover:bg-gray-100"}`}
              aria-label="ตอบไม่ดี"
            >
              👎
            </button>
            <button
              onClick={() => handleRating("funny")}
              disabled={!!rating}
              className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-base transition-all duration-150 ${rating === "funny" ? "opacity-100 bg-yellow-50" : rating ? "opacity-20" : "opacity-40 hover:opacity-90 hover:bg-gray-100"}`}
              aria-label="ฮามาก"
            >
              😂
            </button>
          </div>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-col gap-1 px-1">
            <p className="text-xs text-gray-400">อ่านนโยบายเพิ่มเติมที่</p>
            <div className="flex flex-wrap gap-1">
              {message.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    posthog.capture("source_link_clicked", {
                      category: s.category,
                      source_url: s.source_url,
                    })
                  }
                  className="text-xs font-medium text-[#013920] hover:underline bg-[#86f101]/20 hover:bg-[#86f101]/35 border border-[#86f101]/60 px-2.5 py-1 rounded-full transition-colors duration-150"
                >
                  {s.category} ↗
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
