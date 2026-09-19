import { useEffect, useId, useRef, useState } from "react";
import type {
  Assessment,
  Evidence,
  LLMStatus,
  ThesisRecord,
} from "../../api/schemas";
import EvidenceChat from "./EvidenceChat";
import {
  clampBubblePosition,
  defaultBubblePosition,
  dockStyle,
  readBubblePosition,
  writeBubblePosition,
  type BubblePosition,
} from "./chatBubblePosition";

const DRAG_THRESHOLD = 6;

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3c5.2 0 9.5 3.6 9.5 8.1 0 4.5-4.3 8.1-9.5 8.1-.9 0-1.8-.1-2.6-.3L4.8 21l1.1-3.6C4.3 15.8 3.5 13.6 3.5 11.1 3.5 6.6 7.8 3 12 3z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"
      />
    </svg>
  );
}

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
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState<BubblePosition>(
    () => readBubblePosition() ?? defaultBubblePosition(),
  );
  const custom = useRef(readBubblePosition() !== null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const skipClick = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const onResize = () => {
      setPosition((current) =>
        custom.current ? clampBubblePosition(current) : defaultBubblePosition(),
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const origin = position;
    const drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      moved: false,
      last: origin,
    };

    const move = (next: PointerEvent) => {
      if (next.pointerId !== drag.pointerId) return;
      const dx = next.clientX - drag.startX;
      const dy = next.clientY - drag.startY;
      if (!drag.moved && dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) {
        return;
      }
      drag.moved = true;
      custom.current = true;
      drag.last = clampBubblePosition({
        x: drag.origin.x + dx,
        y: drag.origin.y + dy,
      });
      setDragging(true);
      setPosition(drag.last);
    };

    const stop = (next: PointerEvent) => {
      if (next.pointerId !== drag.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      setDragging(false);
      if (drag.moved) {
        skipClick.current = true;
        writeBubblePosition(drag.last);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  const panelBox = dockStyle(position);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`chat-fab${dragging ? " dragging" : ""}`}
        style={{ left: position.x, top: position.y }}
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        aria-label={open ? "Close chat" : "Ask about this filing"}
        title="Ask about this filing. Drag to move."
        onPointerDown={startDrag}
        onClick={() => {
          if (skipClick.current) {
            skipClick.current = false;
            return;
          }
          setOpen((current) => !current);
        }}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>
      {open ? (
        <section
          ref={panel}
          id={titleId}
          className="chat-dock"
          style={panelBox}
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
            compact
          />
        </section>
      ) : null}
    </>
  );
}
