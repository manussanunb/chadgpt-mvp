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
    <div className="p-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-white border-t border-[#013920]/20">
      <div className="w-full max-w-3xl mx-auto">
      <div className="flex gap-2 items-center bg-white rounded-2xl border border-[#013920]/25 shadow-sm px-3 py-2 focus-within:border-[#013920] focus-within:shadow-md transition-all duration-200">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="ถามเกี่ยวกับนโยบายหรือผลงานของทีมชัชชาติ..."
          rows={1}
          className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm focus:outline-none disabled:text-gray-400 placeholder:text-gray-400"
          style={{ maxHeight: "120px", overflowY: "auto" }}
        />
        <button
          onClick={onSubmit}
          disabled={isLoading || !value.trim()}
          className="flex-shrink-0 min-w-[44px] min-h-[44px] bg-[#013920] hover:bg-[#024f2d] active:scale-95 disabled:bg-[#013920]/20 text-white rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-150"
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          )}
        </button>
      </div>
      </div>
    </div>
  );
}
