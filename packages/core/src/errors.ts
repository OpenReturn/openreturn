/** Protocol-aware error type returned by core services and translated by API adapters. */
export class OpenReturnError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "OpenReturnError";
  }
}

/** Creates a 404 error for missing return resources. */
export function notFound(message: string): OpenReturnError {
  return new OpenReturnError("not_found", message, 404);
}

/** Creates a 400 error for invalid protocol or adapter input. */
export function validationError(message: string, details?: unknown): OpenReturnError {
  return new OpenReturnError("validation_error", message, 400, details);
}

/** Creates a 409 error for invalid lifecycle transitions or conflicting operations. */
export function conflict(message: string, details?: unknown): OpenReturnError {
  return new OpenReturnError("conflict", message, 409, details);
}
