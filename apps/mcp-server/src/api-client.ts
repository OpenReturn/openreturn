import type {
  AddTrackingRequest,
  InitiateReturnRequest,
  OAuthTokenResponse,
  SelectCarrierRequest,
  SelectExchangeRequest
} from "@openreturn/types";

export class OpenReturnApiClient {
  private accessToken?: string;

  public constructor(
    private readonly apiBaseUrl: string,
    private readonly clientId = "openreturn-mcp-agent",
    private readonly subjectToken?: string
  ) {}

  public async initiateReturn(input: InitiateReturnRequest): Promise<unknown> {
    return this.request("/returns", { method: "POST", body: input });
  }

  public async getReturnStatus(id: string): Promise<unknown> {
    return this.request(`/returns/${encodeURIComponent(id)}`);
  }

  public async selectExchange(id: string, input: SelectExchangeRequest): Promise<unknown> {
    return this.request(`/returns/${encodeURIComponent(id)}/exchange`, {
      method: "POST",
      body: input
    });
  }

  public async selectCarrier(id: string, input: SelectCarrierRequest): Promise<unknown> {
    return this.request(`/returns/${encodeURIComponent(id)}/carrier`, {
      method: "POST",
      body: input
    });
  }

  public async getLabel(id: string): Promise<unknown> {
    return this.request(`/returns/${encodeURIComponent(id)}/label`);
  }

  public async trackReturn(id: string, input: AddTrackingRequest): Promise<unknown> {
    return this.request(`/returns/${encodeURIComponent(id)}/track`, {
      method: "POST",
      body: input
    });
  }

  private async request(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<unknown> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.body) {
      headers["content-type"] = "application/json";
    }
    const token = await this.getAccessToken();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(JSON.stringify(payload));
    }
    return payload;
  }

  private async getAccessToken(): Promise<string | undefined> {
    if (this.accessToken) {
      return this.accessToken;
    }
    if (!this.subjectToken && !process.env.OPENRETURN_MCP_USE_CLIENT_TOKEN) {
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
    if (!response.ok) {
      throw new Error(`OAuth request failed with ${response.status}`);
    }
    return (await response.json()) as OAuthTokenResponse;
  }
}
