declare module '@playwright/test' {
  export type APIRequestContext = {
    get(url: string, options?: Record<string, unknown>): Promise<APIResponse>;
    post(url: string, options?: Record<string, unknown>): Promise<APIResponse>;
    patch(url: string, options?: Record<string, unknown>): Promise<APIResponse>;
    delete(url: string, options?: Record<string, unknown>): Promise<APIResponse>;
  };

  export type APIResponse = {
    ok(): boolean;
    status(): number;
    text(): Promise<string>;
    json(): Promise<unknown>;
  };

  export type Page = {
    request: APIRequestContext;
    context(): BrowserContext;
    goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
    url(): string;
  };

  export type BrowserContext = {
    addCookies(cookies: Array<Record<string, unknown>>): Promise<void>;
  };
}
