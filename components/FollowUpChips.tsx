"use client";

import posthog from "posthog-js";

interface FollowUpChipsProps {
  questions: string[] | null;
  onSelect: (question: string) => void;
  disabled: boolean;
}

export function FollowUpChips({ questions, onSelect, disabled }: FollowUpChipsProps) {
  if (questions !== null && questions.length === 0) return null;

  function handleClick(q: string) {
    posthog.capture("follow_up_chip_clicked", { question: q });
    onSelect(q);
  }

  return (
    <div className="flex flex-col gap-1 px-1 mt-1">
      <p className="text-xs text-gray-400">ถามต่อได้เลย</p>
      <div className="flex flex-wrap gap-1.5">
        {questions === null ? (
          <>
            <span className="h-7 w-32 rounded-full bg-[#86f101]/20 border border-[#86f101]/40 animate-pulse" />
            <span className="h-7 w-40 rounded-full bg-[#86f101]/20 border border-[#86f101]/40 animate-pulse" />
            <span className="h-7 w-28 rounded-full bg-[#86f101]/20 border border-[#86f101]/40 animate-pulse" />
          </>
        ) : (
          questions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleClick(q)}
              disabled={disabled}
              className={`group text-xs font-medium text-[#013920] bg-[#86f101]/20 hover:bg-[#86f101]/35 border border-[#86f101]/60 px-3 py-1.5 rounded-full transition-colors duration-150 flex items-center gap-1 ${disabled ? "opacity-40 pointer-events-none" : ""}`}
            >
              <span>{q}</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[#013920]">→</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
