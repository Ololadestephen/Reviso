import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  fetchAuthConfig,
  fetchSession,
  signInWithGoogle,
  signOutSession,
} from "../api/endpoints";
import type { AuthConfig, SessionUser } from "../api/schemas";
import { resetAutoReviewKeys } from "../lib/autoReview";

const SESSION_KEY = ["auth", "session"] as const;
const CONFIG_KEY = ["auth", "config"] as const;

type AuthState = {
  user: SessionUser | null;
  config: AuthConfig | undefined;
  loading: boolean;
  error: string | null;
  signInGoogle: (credential: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function dropResearchQueries(queryClient: ReturnType<typeof useQueryClient>) {
  resetAutoReviewKeys();
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== "auth",
  });
}

async function applySession(
  queryClient: ReturnType<typeof useQueryClient>,
  next: SessionUser | null,
) {
  await queryClient.cancelQueries({ queryKey: SESSION_KEY });
  dropResearchQueries(queryClient);
  queryClient.setQueryData(SESSION_KEY, next);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const previousUser = useRef<string | null | undefined>(undefined);
  const session = useQuery({
    queryKey: SESSION_KEY,
    queryFn: ({ signal }) => fetchSession(signal),
    retry: false,
    staleTime: 30_000,
  });
  const config = useQuery({
    queryKey: CONFIG_KEY,
    queryFn: ({ signal }) => fetchAuthConfig(signal),
    retry: false,
    staleTime: 60_000,
  });

  const user = session.data ?? null;

  useEffect(() => {
    const current = user?.user_id ?? null;
    const previous = previousUser.current;
    previousUser.current = current;
    if (previous === undefined || previous === current) return;
    if (previous === null && current) return;
    dropResearchQueries(queryClient);
  }, [queryClient, user?.user_id]);

  useEffect(() => {
    const onSignedOut = () => {
      void (async () => {
        const current = await fetchSession();
        if (current) {
          queryClient.setQueryData(SESSION_KEY, current);
          return;
        }
        await applySession(queryClient, null);
      })();
    };
    window.addEventListener("reviso:signed-out", onSignedOut);
    return () => window.removeEventListener("reviso:signed-out", onSignedOut);
  }, [queryClient]);

  const signInGoogle = useCallback(
    async (credential: string) => {
      const next = await signInWithGoogle(credential);
      await applySession(queryClient, next);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await signOutSession();
    await applySession(queryClient, null);
    navigate("/app", { replace: true });
  }, [navigate, queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      config: config.data,
      loading: session.isPending || config.isPending,
      error: session.error?.message ?? config.error?.message ?? null,
      signInGoogle,
      signOut,
    }),
    [
      config.data,
      config.error?.message,
      config.isPending,
      session.error?.message,
      session.isPending,
      signInGoogle,
      signOut,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
