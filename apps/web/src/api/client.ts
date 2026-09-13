import { z } from "zod";

/** A response the API returned and explained. `status` drives recovery in the UI. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Optimistic-concurrency rejection: the caller holds a stale version. */
  get isConflict() {
    return this.status === 409;
  }

  /** The thesis must be confirmed and active before this action is available. */
  get isUnavailable() {
    return this.status === 503;
  }
}

/**
 * The API answered with a shape the client does not recognize. This is a bug on
 * one side of the contract, never user error, so it is reported separately from
 * ApiError rather than shown as if the request were invalid.
 */
export class ContractError extends Error {
  constructor(
    readonly path: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(
      `The API response for ${path} did not match the expected contract: ${issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "ContractError";
  }
}

const validationIssue = z.object({
  loc: z.array(z.union([z.string(), z.number()])),
  msg: z.string(),
});

function describe(status: number, payload: unknown): string {
  const detail = z.object({ detail: z.unknown() }).safeParse(payload)
    .data?.detail;
  if (typeof detail === "string") return detail;
  const issues = z.array(validationIssue).safeParse(detail);
  if (issues.success && issues.data.length > 0) {
    return issues.data
      .map((issue) => {
        const field = issue.loc.filter((part) => part !== "body").join(".");
        return field ? `${field}: ${issue.msg}` : issue.msg;
      })
      .join("; ");
  }
  return `The request failed (HTTP ${status}).`;
}

interface SendOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}

async function send<T>(
  path: string,
  schema: z.ZodType<T>,
  { method = "GET", body, signal }: SendOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(0, "The research API is unreachable. Is it running?");
  }

  const payload = await response.json().catch(() => undefined);
  if (!response.ok)
    throw new ApiError(response.status, describe(response.status, payload));

  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ContractError(path, parsed.error.issues);
  return parsed.data;
}

export const get = <T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
) => send(path, schema, { signal });

export const post = <T>(
  path: string,
  schema: z.ZodType<T>,
  body: unknown = {},
) => send(path, schema, { method: "POST", body });
