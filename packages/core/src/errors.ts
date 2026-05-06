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

export function notFound(message: string): OpenReturnError {
  return new OpenReturnError("not_found", message, 404);
}

export function validationError(message: string, details?: unknown): OpenReturnError {
  return new OpenReturnError("validation_error", message, 400, details);
}

export function conflict(message: string, details?: unknown): OpenReturnError {
  return new OpenReturnError("conflict", message, 409, details);
}
