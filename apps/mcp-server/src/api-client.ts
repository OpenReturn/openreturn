import type {
  AddTrackingRequest,
  InitiateReturnRequest,
  InitiateReturnResponse,
  ListReturnsRequest,
  LookupOrderRequest,
  OAuthTokenResponse,
  OpenReturnDiscoveryDocument,
  OpenReturnRecord,
  Order,
  ReturnEvent,
  SelectCarrierRequest,
  SelectExchangeRequest,
  ShippingLabel,
  UpdateReturnRequest,
  WebhookEvent
} from "@openreturn/types";

/** REST API client used by MCP tools to call an OpenReturn API server. */
export class OpenReturnApiClient {
  private readonly apiBaseUrl: string;
  private accessToken?: string;

  public constructor(
    apiBaseUrl: string,
    private readonly clientId = "openreturn-mcp-agent",
    private readonly subjectToken?: string
  ) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, "");
  }

  /** Reads the retailer discovery document. */
  public async discover(): Promise<OpenReturnDiscoveryDocument> {
    return this.request<OpenReturnDiscoveryDocument>("/.well-known/openreturn");
  }

  /** Looks up an order through the API's configured commerce adapter. */
  public async lookupOrder(input: LookupOrderRequest): Promise<{ order: Order }> {
    const query = input.email ? `?email=${encodeURIComponent(input.email)}` : "";
    return this.request<{ order: Order }>(`/orders/${encodeURIComponent(input.orderId)}${query}`);
  }

  /** Lists returns with optional status, email, and limit filters. */
  public async listReturns(
    input: ListReturnsRequest = {}
  ): Promise<{ returns: OpenReturnRecord[] }> {
    const params = new URLSearchParams();
    if (input.status) {
      params.set("status", input.status);
    }
    if (input.email) {
      params.set("email", input.email);
    }
    if (input.limit) {
      params.set("limit", String(input.limit));
    }
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return this.request<{ returns: OpenReturnRecord[] }>(`/returns${query}`);
  }

  /** Initiates a return through the REST API. */
  public async initiateReturn(input: InitiateReturnRequest): Promise<InitiateReturnResponse> {
    return this.request<InitiateReturnResponse>("/returns", { method: "POST", body: input });
  }

  /** Fetches a return record by id. */
  public async getReturnStatus(id: string): Promise<{ return: OpenReturnRecord }> {
    return this.request<{ return: OpenReturnRecord }>(`/returns/${encodeURIComponent(id)}`);
  }

  /** Applies lifecycle or resolution updates to a return. */
  public async updateReturn(
    id: string,
    input: UpdateReturnRequest
  ): Promise<{ return: OpenReturnRecord }> {
    return this.request<{ return: OpenReturnRecord }>(`/returns/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: input
    });
  }

  /** Selects replacement items for an exchange return. */
  public async selectExchange(
    id: string,
    input: SelectExchangeRequest
  ): Promise<{ return: OpenReturnRecord }> {
    return this.request<{ return: OpenReturnRecord }>(
      `/returns/${encodeURIComponent(id)}/exchange`,
      {
        method: "POST",
        body: input
      }
    );
  }

  /** Selects a carrier and generates a label for a return. */
  public async selectCarrier(
    id: string,
    input: SelectCarrierRequest
  ): Promise<{ return: OpenReturnRecord }> {
    return this.request<{ return: OpenReturnRecord }>(
      `/returns/${encodeURIComponent(id)}/carrier`,
      {
        method: "POST",
        body: input
      }
    );
  }

  /** Retrieves generated shipping label metadata. */
  public async getLabel(id: string): Promise<{ label: ShippingLabel }> {
    return this.request<{ label: ShippingLabel }>(`/returns/${encodeURIComponent(id)}/label`);
  }

  /** Adds a carrier tracking event to a return. */
  public async trackReturn(
    id: string,
    input: AddTrackingRequest
  ): Promise<{ return: OpenReturnRecord }> {
    return this.request<{ return: OpenReturnRecord }>(`/returns/${encodeURIComponent(id)}/track`, {
      method: "POST",
      body: input
    });
  }

  /** Retrieves the event history for a return. */
  public async getReturnEvents(id: string): Promise<{ events: ReturnEvent[] }> {
    return this.request<{ events: ReturnEvent[] }>(`/returns/${encodeURIComponent(id)}/events`);
  }

  /** Submits a carrier or commerce webhook event to the REST API. */
  public async receiveWebhook(
    input: WebhookEvent
  ): Promise<{ accepted: boolean; return: OpenReturnRecord | null }> {
    return this.request<{ accepted: boolean; return: OpenReturnRecord | null }>("/webhooks", {
      method: "POST",
      body: input
    });
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
    }
    const token = await this.getAccessToken();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    const payload = await parseJsonResponse<T>(response);
    if (!response.ok) {
      throw new Error(formatApiError(response.status, payload));
    }
    return payload;
  }

  private async getAccessToken(): Promise<string | undefined> {
    if (this.accessToken) {
      return this.accessToken;
    }
    const useClientToken = process.env.OPENRETURN_MCP_USE_CLIENT_TOKEN === "true";
    if (!this.subjectToken && !useClientToken) {
      return undefined;
    }

    const tokenResponse = await this.fetchToken("/oauth/token", {
      client_id: this.clientId,
      scope: "returns:read returns:write returns:track agent:delegate"
    });

    if (!this.subjectToken) {
      this.accessToken = tokenResponse.access_token;
      return this.accessToken;
    }

    const delegated = await this.fetchToken(
      "/oauth/delegate",
      {
        subjectToken: this.subjectToken,
        actor: this.clientId,
        scope: "returns:read returns:write returns:track"
      },
      tokenResponse.access_token
    );
    this.accessToken = delegated.access_token;
    return this.accessToken;
  }

  private async fetchToken(
    path: string,
    body: Record<string, string>,
    bearer?: string
  ): Promise<OAuthTokenResponse> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (bearer) {
      headers.authorization = `Bearer ${bearer}`;
    }
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const payload = await parseJsonResponse<OAuthTokenResponse>(response);
    if (!response.ok) {
      throw new Error(formatApiError(response.status, payload));
    }
    return payload;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`OpenReturn API returned non-JSON response with ${response.status}`);
  }
}

function formatApiError(status: number, payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error
  ) {
    return `OpenReturn API request failed with ${status}: ${String(payload.error.message)}`;
  }
  return `OpenReturn API request failed with ${status}: ${JSON.stringify(payload)}`;
}
