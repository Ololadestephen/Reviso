// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test.each([
  ["Privacy", "What this demo saves and sends."],
  ["Terms", "Use Reviso as a research record."],
  ["Guide", "Use evidence to test a stock idea before you act."],
  [
    "NVIDIA example",
    "One NVIDIA idea, two dated filings, and a human decision.",
  ],
])("the footer %s link opens its page at the top", (link, heading) => {
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );
  vi.spyOn(window, "scrollY", "get").mockReturnValue(1800);
  fireEvent.scroll(window);
  scrollTo.mockClear();

  fireEvent.click(
    within(screen.getByRole("contentinfo")).getByRole("link", { name: link }),
  );

  expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith({
    top: 0,
    left: 0,
    behavior: "instant",
  });
});

test("scrolling within a public page does not reset its position", () => {
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(
    <MemoryRouter initialEntries={["/privacy"]}>
      <App />
    </MemoryRouter>,
  );
  scrollTo.mockClear();

  vi.spyOn(window, "scrollY", "get").mockReturnValue(1800);
  fireEvent.scroll(window);

  expect(scrollTo).not.toHaveBeenCalled();
});
