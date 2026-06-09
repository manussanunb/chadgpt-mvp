"use client";

import ReactMarkdown from "react-markdown";

interface Source {
  category: string;
  source_url: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-[#013920] text-white rounded-br-sm whitespace-pre-wrap"
              : "bg-white border-l-[3px] border-l-[#013920] border border-[#013920]/10 text-gray-800 rounded-bl-sm shadow-sm prose prose-sm max-w-none"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#013920] underline decoration-dotted underline-offset-2">
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

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
                  className="text-xs text-[#013920] hover:underline bg-[#86f101]/20 border border-[#86f101]/60 px-2 py-0.5 rounded-full"
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
