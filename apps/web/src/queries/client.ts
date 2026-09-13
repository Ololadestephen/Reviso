import { QueryClient } from "@tanstack/react-query";
import { ApiError, ContractError } from "../api/client";

/**
 * Retrying a rejected contract or a 4xx only repeats the same answer. Retries
 * are reserved for transport failures, which is the case a local research
 * workbench actually hits: the API process not being up yet.
 */
function retry(failureCount: number, error: Error) {
  if (error instanceof ContractError) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500)
    return false;
  return failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry, staleTime: 15_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export const queryKeys = {
  theses: ["theses"] as const,
  thesis: (id: string) => ["theses", id] as const,
  history: (id: string) => ["theses", id, "history"] as const,
  llmStatus: ["llm-status"] as const,
  instruments: ["instruments"] as const,
  questions: (id: string) => ["theses", id, "questions"] as const,
};
