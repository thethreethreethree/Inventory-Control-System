/** Error carrying an HTTP status for the route layer to surface. */
export function httpError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

export function statusOf(err: unknown): number {
  if (err && typeof err === "object" && "statusCode" in err) {
    const s = (err as { statusCode?: unknown }).statusCode;
    if (typeof s === "number") return s;
  }
  return 500;
}
