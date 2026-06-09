"use client";

import { useRef, KeyboardEvent } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function ChatInput({ value, onChange, onSubmit, isLoading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) onSubmit();
    }
  }

  return (
    <div className="flex gap-2 items-end p-4 border-t border-[#013920] bg-white">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="ถามเกี่ยวกับนโยบายหรือผลงานของทีมชัชชาติ..."
        rows={1}
        className="flex-1 resize-none rounded-xl border border-[#013920]/30 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#86f101] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
        style={{ maxHeight: "120px", overflowY: "auto" }}
      />
      <button
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        className="flex-shrink-0 bg-[#013920] hover:bg-[#013920]/80 disabled:bg-[#013920]/25 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            กำลังตอบ
          </span>
        ) : (
          "ส่ง"
        )}
      </button>
    </div>
  );
}
