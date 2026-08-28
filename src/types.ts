export interface SiteHttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
}

export interface SiteHttpClient {
  get<T = unknown>(
    url: string,
    options?: SiteHttpRequestOptions,
  ): Promise<SiteHttpResponse<T>>;

  post<T = unknown>(
    url: string,
    body: unknown,
    options?: SiteHttpRequestOptions,
  ): Promise<SiteHttpResponse<T>>;
}

export interface SiteHttpRequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  maxRedirects?: number;
  responseType?: 'arraybuffer' | 'text';
  validateStatus?: (status: number) => boolean;
}

export interface CaptchaSolver {
  solve(imageBase64: string): Promise<string | null>;
}

export interface SiteSdkConfig {
  /** Runtime site origin supplied by the host backend. No default is ever used. */
  domain: string;
  userAgent?: string;
  loginPath?: string;
  validationPath?: string;
  filePath?: (fileId: string) => string;
}

export interface LoginSuccess {
  success: true;
}

export type LoginError =
  | 'INVALID_INPUT'
  | 'LOGIN_FAILED'
  | 'CAPTCHA_FAILED'
  | 'REQUEST_FAILED';

export interface LoginFailure {
  success: false;
  error: LoginError;
  message: string;
}

export type LoginResult = LoginSuccess | LoginFailure;

export type FileInfoError =
  | 'INVALID_FILE_ID'
  | 'SESSION_EXPIRED'
  | 'FILE_RATE_LIMITED'
  | 'NO_DOWNLOAD_LINK'
  | 'REQUEST_FAILED';

export interface FileInfoSuccess {
  success: true;
  fileId: string;
  title?: string;
  downloadUrl: string;
  expectedBytes?: number;
}

export interface FileInfoFailure {
  success: false;
  fileId: string | null;
  error: FileInfoError;
  retryAfter?: number;
  message?: string;
}

export type FileInfoResult = FileInfoSuccess | FileInfoFailure;

export interface SiteFailureClassification {
  retryable: boolean;
  reason:
    | 'SESSION_EXPIRED'
    | 'RATE_LIMITED'
    | 'NOT_FOUND'
    | 'NO_RESOURCE'
    | 'REQUEST_FAILED';
}
