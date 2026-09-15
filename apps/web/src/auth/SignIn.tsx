import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RevisoMark } from "../components/Brand";
import { useAuth } from "./AuthProvider";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: string;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string>,
          ) => void;
        };
      };
    };
  }
}

function loadGoogleScript() {
  if (window.google?.accounts.id) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      "script[data-reviso-google]",
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.revisoGoogle = "true";
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });
}

export default function SignIn() {
  const { config, signInGoogle, error } = useAuth();
  const button = useRef<HTMLDivElement>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = config?.google_client_id;
    if (config?.mode !== "google" || !clientId || !button.current) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !button.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: (response) => {
            void signInGoogle(response.credential).catch((caught: unknown) => {
              setGoogleError(
                caught instanceof Error
                  ? caught.message
                  : "Google sign-in was rejected",
              );
            });
          },
        });
        button.current.replaceChildren();
        window.google.accounts.id.renderButton(button.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: "320",
        });
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleError("Google sign-in could not be loaded in this browser.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [config, signInGoogle]);

  return (
    <div className="sign-in-shell">
      <div className="sign-in-card">
        <Link className="brand app-brand" to="/" aria-label="Reviso home">
          <RevisoMark />
          <span>Reviso</span>
        </Link>
        <p className="eyebrow">YOUR RESEARCH</p>
        <h1>Continue with Google</h1>
        <p>
          Each person gets their own saved ideas, findings and chats. Signing in
          on another device restores this account, not someone else’s.
        </p>
        <div ref={button} className="google-button" />
        {(googleError || error) && (
          <div role="alert" className="error">
            {googleError || error}
          </div>
        )}
        <p className="caption">
          Public filings stay shared. Your notebook stays private. Reviso cannot
          place trades.
        </p>
        <Link to="/example">View the NVIDIA example</Link>
      </div>
    </div>
  );
}
