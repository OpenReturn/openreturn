import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { OAuthTokenResponse } from "@openreturn/types";
import type { ApiConfig } from "../config";

export interface AuthClaims {
  sub: string;
  iss: string;
  aud: string;
  scope: string;
  act?: {
    sub: string;
  };
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthClaims;
}

export class OAuthTokenService {
  public constructor(private readonly config: ApiConfig) {}

  public issueClientToken(clientId: string, scope: string): OAuthTokenResponse {
    return this.sign({ sub: clientId, scope });
  }

  public issueDelegatedToken(subject: AuthClaims, actor: string, scope: string): OAuthTokenResponse {
    return this.sign({ sub: subject.sub, scope, act: { sub: actor } });
  }

  public verify(token: string): AuthClaims {
    return jwt.verify(token, this.config.oauthTokenSecret, {
      issuer: this.config.oauthIssuer,
      audience: this.config.oauthAudience
    }) as AuthClaims;
  }

  private sign(claims: Pick<AuthClaims, "sub" | "scope"> & Partial<Pick<AuthClaims, "act">>): OAuthTokenResponse {
    const expiresIn = 60 * 60;
    const accessToken = jwt.sign(
      {
        scope: claims.scope,
        act: claims.act
      },
      this.config.oauthTokenSecret,
      {
        subject: claims.sub,
        issuer: this.config.oauthIssuer,
        audience: this.config.oauthAudience,
        expiresIn
      }
    );

    const response: OAuthTokenResponse = {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: claims.scope
    };
    if (claims.act) {
      response.delegated_subject = claims.sub;
    }
    return response;
  }
}

export function optionalAuth(tokenService: OAuthTokenService) {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction): void => {
    const header = request.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      next();
      return;
    }
    try {
      request.auth = tokenService.verify(header.slice("Bearer ".length));
      next();
    } catch {
      next();
    }
  };
}

export function requireAuth(tokenService: OAuthTokenService, requiredScope?: string) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction): void => {
    const header = request.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      response.status(401).json({ error: { code: "unauthorized", message: "Bearer token required" } });
      return;
    }

    try {
      const claims = tokenService.verify(header.slice("Bearer ".length));
      if (requiredScope && !claims.scope.split(" ").includes(requiredScope)) {
        response.status(403).json({ error: { code: "forbidden", message: "Required scope missing" } });
        return;
      }
      request.auth = claims;
      next();
    } catch (error) {
      response.status(401).json({
        error: {
          code: "invalid_token",
          message: error instanceof Error ? error.message : "Invalid bearer token"
        }
      });
    }
  };
}
