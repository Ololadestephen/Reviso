export const CHAT_BUBBLE_SIZE = 56;
export const CHAT_BUBBLE_MARGIN = 16;
export const CHAT_BUBBLE_STORAGE_KEY = "reviso.chatBubble.v1";

export type BubblePosition = { x: number; y: number };

export function defaultBubblePosition(
  width = window.innerWidth,
  height = window.innerHeight,
): BubblePosition {
  const x = Math.max(
    CHAT_BUBBLE_MARGIN,
    width - CHAT_BUBBLE_SIZE - CHAT_BUBBLE_MARGIN,
  );
  const y = Math.max(
    CHAT_BUBBLE_MARGIN,
    height - CHAT_BUBBLE_MARGIN - CHAT_BUBBLE_SIZE,
  );
  return { x, y };
}

export function clampBubblePosition(
  position: BubblePosition,
  width = window.innerWidth,
  height = window.innerHeight,
): BubblePosition {
  const maxX = Math.max(
    CHAT_BUBBLE_MARGIN,
    width - CHAT_BUBBLE_SIZE - CHAT_BUBBLE_MARGIN,
  );
  const maxY = Math.max(
    CHAT_BUBBLE_MARGIN,
    height - CHAT_BUBBLE_SIZE - CHAT_BUBBLE_MARGIN,
  );
  return {
    x: Math.min(maxX, Math.max(CHAT_BUBBLE_MARGIN, position.x)),
    y: Math.min(maxY, Math.max(CHAT_BUBBLE_MARGIN, position.y)),
  };
}

function memoryStorage() {
  try {
    const store = window.localStorage;
    if (store && typeof store.getItem === "function") return store;
  } catch {
    return null;
  }
  return null;
}

export function readBubblePosition(): BubblePosition | null {
  try {
    const raw = memoryStorage()?.getItem(CHAT_BUBBLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number")
      return null;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
    return clampBubblePosition({ x: parsed.x, y: parsed.y });
  } catch {
    return null;
  }
}

export function writeBubblePosition(position: BubblePosition) {
  try {
    memoryStorage()?.setItem(
      CHAT_BUBBLE_STORAGE_KEY,
      JSON.stringify(clampBubblePosition(position)),
    );
  } catch {
    return;
  }
}

export function dockOpensDown(
  position: BubblePosition,
  height = window.innerHeight,
) {
  return position.y < height / 2;
}

export function dockStyle(
  position: BubblePosition,
  width = window.innerWidth,
  height = window.innerHeight,
): { left: number; top?: number; bottom?: number; maxHeight: number } {
  const panelWidth = Math.min(440, Math.max(280, width - 24));
  const alignRight = position.x + CHAT_BUBBLE_SIZE / 2 > width / 2;
  const left = alignRight
    ? Math.max(12, position.x + CHAT_BUBBLE_SIZE - panelWidth)
    : Math.min(position.x, Math.max(12, width - panelWidth - 12));
  if (dockOpensDown(position, height)) {
    const top = position.y + CHAT_BUBBLE_SIZE + 12;
    return {
      left,
      top,
      maxHeight: Math.max(0, Math.min(640, height - top - 12)),
    };
  }
  const bottom = height - position.y + 12;
  return {
    left,
    bottom,
    maxHeight: Math.max(0, Math.min(640, height - bottom - 12)),
  };
}
