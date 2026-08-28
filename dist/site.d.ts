import type { CaptchaSolver, FileInfoResult, LoginResult, SiteFailureClassification, SiteHttpClient, SiteSdkConfig } from './types.js';
export declare class SiteSdk {
    private readonly config;
    readonly domain: string;
    readonly userAgent: string;
    constructor(config: SiteSdkConfig);
    private loginPath;
    private validationPath;
    private filePath;
    private headers;
    login(http: SiteHttpClient, captchaSolver: CaptchaSolver, username: string, password: string, options?: {
        maxAttempts?: number;
    }): Promise<LoginResult>;
    validateSession(http: SiteHttpClient): Promise<boolean>;
    fetchFileInfo(http: SiteHttpClient, input: string): Promise<FileInfoResult>;
    classifyFileInfo(result: FileInfoResult): SiteFailureClassification | null;
}
export declare function createSiteSdk(config: SiteSdkConfig): SiteSdk;
//# sourceMappingURL=site.d.ts.map