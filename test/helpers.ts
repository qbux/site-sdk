import type {
  CaptchaSolver,
  SiteHttpClient,
  SiteHttpRequestOptions,
  SiteHttpResponse,
} from '../src/index.js';

export class MockHttp implements SiteHttpClient {
  readonly requests: Array<{
    method: 'GET' | 'POST';
    url: string;
    body?: unknown;
    options?: SiteHttpRequestOptions;
  }> = [];

  private readonly responses: Array<SiteHttpResponse>;

  constructor(responses: SiteHttpResponse[] = []) {
    this.responses = [...responses];
  }

  queue<T>(response: SiteHttpResponse<T>): void {
    this.responses.push(response as SiteHttpResponse);
  }

  async get<T>(url: string, options?: SiteHttpRequestOptions): Promise<SiteHttpResponse<T>> {
    this.requests.push({ method: 'GET', url, options });
    return this.next<T>();
  }

  async post<T>(url: string, body: unknown, options?: SiteHttpRequestOptions): Promise<SiteHttpResponse<T>> {
    this.requests.push({ method: 'POST', url, body, options });
    return this.next<T>();
  }

  private async next<T>(): Promise<SiteHttpResponse<T>> {
    const response = this.responses.shift();
    if (!response) throw new Error('MockHttp response queue is empty');
    return response as SiteHttpResponse<T>;
  }
}

export class MockCaptcha implements CaptchaSolver {
  calls: string[] = [];
  constructor(private readonly answer: string | null) {}

  async solve(imageBase64: string): Promise<string | null> {
    this.calls.push(imageBase64);
    return this.answer;
  }
}

export function response<T>(status: number, data: T): SiteHttpResponse<T> {
  return { status, data, headers: {} };
}
