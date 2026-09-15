import { useEffect, useId, useRef, useState } from "react";
import type {
  Assessment,
  Evidence,
  LLMStatus,
  ThesisRecord,
} from "../../api/schemas";
import EvidenceChat from "./EvidenceChat";

export default function EvidenceChatDock({
  latest,
  record,
  llmStatus,
  statusUnavailable = false,
  onSource,
}: {
  latest: Assessment;
  record: ThesisRecord;
  llmStatus: LLMStatus;
  statusUnavailable?: boolean;
  onSource: (source: Evidence) => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const field = panel.current?.querySelector("textarea");
    field?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="chat-fab"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Close chat" : "Ask about this filing"}
      </button>
      {open ? (
        <section
          ref={panel}
          id={titleId}
          className="chat-dock"
          role="dialog"
          aria-labelledby="evidence-chat-title"
        >
          <div className="chat-dock-head">
            <p className="caption">Bound to this saved filing</p>
            <button
              type="button"
              className="quiet"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
            >
              Close
            </button>
          </div>
          <EvidenceChat
            latest={latest}
            record={record}
            llmStatus={llmStatus}
            statusUnavailable={statusUnavailable}
            onSource={onSource}
          />
        </section>
      ) : null}
    </>
  );
}
