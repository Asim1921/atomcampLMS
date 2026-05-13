"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: "popup" | "redirect";
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

type Props = {
  onCredential: (credential: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
  disabled?: boolean;
};

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleButton({ onCredential, text = "continue_with", disabled }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const handlerRef = useRef(onCredential);
  handlerRef.current = onCredential;

  const tryRender = useCallback(() => {
    if (!CLIENT_ID || !window.google || !containerRef.current) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => {
        if (response.credential) handlerRef.current(response.credential);
      },
      ux_mode: "popup",
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    containerRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(containerRef.current, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text,
      shape: "rectangular",
      logo_alignment: "left",
      width: 360,
    });
    setReady(true);
  }, [text]);

  useEffect(() => {
    if (window.google) tryRender();
  }, [tryRender]);

  if (!CLIENT_ID) {
    return (
      <div className="rounded-lg border border-dashed border-atom-border bg-atom-deep/60 p-3 text-xs text-atom-muted">
        Google sign-in is disabled until <code className="text-atom-accent">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> is set in your env file.
      </div>
    );
  }

  return (
    <div className={disabled ? "pointer-events-none opacity-60" : undefined}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={tryRender} />
      <div ref={containerRef} className="flex justify-center" />
      {!ready && (
        <div className="h-11 w-full animate-pulse rounded-md border border-atom-border/60 bg-atom-deep/50" />
      )}
    </div>
  );
}
