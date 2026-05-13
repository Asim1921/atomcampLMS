"use client";

import { MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";

import { tutorStream } from "@/lib/api";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Props = {
  learnerId: string | null;
};

export function TutorDrawer({ learnerId }: Props) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState<string>("");

  async function send() {
    if (!learnerId || !msg.trim()) return;
    setLog("");
    const userLine = msg;
    setMsg("");
    setLog("Thinking…\n\n");
    let acc = "";
    await tutorStream(learnerId, userLine, (chunk) => {
      acc += chunk;
      setLog(acc);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-atom-accent to-cyan-500 text-atom-deep shadow-glow transition hover:scale-105"
        aria-label="Open AI tutor"
      >
        <MessageCircle className="h-7 w-7" />
      </button>
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-atom-border bg-atom-navy shadow-2xl">
          <div className="flex items-center justify-between border-b border-atom-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-atom-text">AtomAdapt Tutor</p>
              <p className="text-xs text-atom-muted">Streaming · grounded in Learner DNA</p>
            </div>
            <button type="button" className="rounded-lg p-2 text-atom-muted hover:bg-atom-panel" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-atom-text whitespace-pre-wrap">
            {!learnerId && <p className="text-atom-muted">Select a learner profile first.</p>}
            {learnerId && (log || "Ask anything about your goal, study plan, or atomcamp-style bootcamp paths.")}
          </div>
          <div className="border-t border-atom-border p-3">
            <div className="flex gap-2">
              <Input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Ask the tutor…"
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={!learnerId}
              />
              <Button size="icon" onClick={send} disabled={!learnerId || !msg.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
