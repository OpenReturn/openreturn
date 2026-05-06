export class AdapterError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AdapterError";
  }
}
