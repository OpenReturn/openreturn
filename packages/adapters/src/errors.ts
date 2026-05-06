/** Error type raised by carrier, commerce, ERP, and payment adapters. */
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
