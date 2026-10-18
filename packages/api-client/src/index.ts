import type { paths } from "./schema.ts";

export type HealthResponse =
  paths["/v1/health"]["get"]["responses"][200]["content"]["application/json"];
export type SessionResponse =
  paths["/v1/session"]["get"]["responses"][200]["content"]["application/json"];
export type ApiModule =
  | "sellers"
  | "listings"
  | "requests"
  | "proposals"
  | "chat"
  | "orders"
  | "payments"
  | "shipping"
  | "reviews"
  | "moderation"
  | "admin"
  | "markets";
type ModulePath<M extends ApiModule> = `/v1/${M}`;
export type ModuleResponse<M extends ApiModule = ApiModule> =
  paths[ModulePath<M>]["get"]["responses"][200]["content"]["application/json"];
export type SignUploadInput =
  paths["/v1/uploads/sign"]["post"]["requestBody"]["content"]["application/json"];
export type SignUploadResponse =
  paths["/v1/uploads/sign"]["post"]["responses"][201]["content"]["application/json"];
export type CompleteUploadInput =
  paths["/v1/uploads/complete"]["post"]["requestBody"]["content"]["application/json"];
export type CompleteUploadResponse =
  paths["/v1/uploads/complete"]["post"]["responses"][202]["content"]["application/json"];
export type CatalogAdminEntity =
  paths["/v1/admin/catalog/{entity}"]["get"]["parameters"]["path"]["entity"];
export type CatalogAdminRecord = Record<string, unknown>;
export type CatalogImportResponse =
  paths["/v1/admin/catalog/imports"]["post"]["responses"][201]["content"]["application/json"];
export type CatalogSearchResponse =
  paths["/v1/catalog/search"]["get"]["responses"][200]["content"]["application/json"];
type GeneratedCatalogSearchQuery = NonNullable<
  paths["/v1/catalog/search"]["get"]["parameters"]["query"]
>;
export type CatalogSearchQuery = Omit<
  GeneratedCatalogSearchQuery,
  "hasWarranty"
> & {
  hasWarranty?: boolean;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;
  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export function createApiClient(input: {
  baseUrl: string;
  fetcher?: typeof fetch;
}) {
  const fetcher = input.fetcher ?? fetch;
  async function request<T>(
    path: string,
    token?: string,
    headers: Record<string, string> = {},
    options: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      body?: unknown;
    } = {},
  ): Promise<T> {
    const requestHeaders = {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    };
    const response = await fetcher(new URL(path, input.baseUrl), {
      ...(Object.keys(requestHeaders).length
        ? { headers: requestHeaders }
        : {}),
      method: options.method ?? "GET",
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
    });
    const body = (await response.json()) as
      | T
      | { error?: { code?: string; message?: string; requestId?: string } };
    if (!response.ok) {
      const failure = body as {
        error?: { code?: string; message?: string; requestId?: string };
      };
      throw new ApiClientError(
        response.status,
        failure.error?.code ?? "API_REQUEST_FAILED",
        failure.error?.message ?? "Falha na API",
        failure.error?.requestId,
      );
    }
    return body as T;
  }
  return {
    health: () => request<HealthResponse>("/v1/health"),
    session: (token: string) => request<SessionResponse>("/v1/session", token),
    module: <M extends ApiModule>(
      module: M,
      token: string,
      options: { market?: string; cursor?: string; sellerId?: string } = {},
    ) => {
      const url = new URL(`/v1/${module}`, input.baseUrl);
      if (options.market) url.searchParams.set("market", options.market);
      if (options.cursor) url.searchParams.set("cursor", options.cursor);
      return request<ModuleResponse<M>>(
        `${url.pathname}${url.search}`,
        token,
        options.sellerId ? { "x-seller-id": options.sellerId } : {},
      );
    },
    signUpload: (token: string, sellerId: string, body: SignUploadInput) =>
      request<SignUploadResponse>(
        "/v1/uploads/sign",
        token,
        { "x-seller-id": sellerId },
        { method: "POST", body },
      ),
    completeUpload: (
      token: string,
      sellerId: string,
      body: CompleteUploadInput,
    ) =>
      request<CompleteUploadResponse>(
        "/v1/uploads/complete",
        token,
        { "x-seller-id": sellerId },
        { method: "POST", body },
      ),
    searchCatalog: (query: CatalogSearchQuery = {}) =>
      request<CatalogSearchResponse>(withQuery("/v1/catalog/search", query)),
    catalogMachineTypes: () =>
      request<CatalogResponse<"/v1/catalog/machine-types">>(
        "/v1/catalog/machine-types",
      ),
    catalogBrands: (query: { machineTypeId?: string } = {}) =>
      request<CatalogResponse<"/v1/catalog/brands">>(
        withQuery("/v1/catalog/brands", query),
      ),
    catalogModels: (query: { brandId?: string; machineTypeId?: string } = {}) =>
      request<CatalogResponse<"/v1/catalog/models">>(
        withQuery("/v1/catalog/models", query),
      ),
    catalogYears: (modelId: string) =>
      request<CatalogResponse<"/v1/catalog/years">>(
        withQuery("/v1/catalog/years", { modelId }),
      ),
    catalogCategories: () =>
      request<CatalogResponse<"/v1/catalog/categories">>(
        "/v1/catalog/categories",
      ),
    catalogPartsByCode: (code: string) =>
      request<CatalogResponse<"/v1/catalog/parts/{code}">>(
        `/v1/catalog/parts/${encodeURIComponent(code)}`,
      ),
    catalogCompatibilities: (partId: string) =>
      request<CatalogResponse<"/v1/catalog/compatibilities">>(
        withQuery("/v1/catalog/compatibilities", { partId }),
      ),
    listCatalogAdmin: (entity: CatalogAdminEntity, token: string) =>
      request<{ data: CatalogAdminRecord[] }>(
        `/v1/admin/catalog/${entity}`,
        token,
      ),
    createCatalogAdmin: (
      entity: CatalogAdminEntity,
      token: string,
      body: CatalogAdminRecord,
    ) =>
      request<CatalogAdminRecord>(
        `/v1/admin/catalog/${entity}`,
        token,
        {},
        { method: "POST", body },
      ),
    updateCatalogAdmin: (
      entity: CatalogAdminEntity,
      id: string,
      token: string,
      body: CatalogAdminRecord,
    ) =>
      request<CatalogAdminRecord>(
        `/v1/admin/catalog/${entity}/${encodeURIComponent(id)}`,
        token,
        {},
        { method: "PATCH", body },
      ),
    deactivateCatalogAdmin: (
      entity: CatalogAdminEntity,
      id: string,
      token: string,
    ) =>
      request<CatalogAdminRecord>(
        `/v1/admin/catalog/${entity}/${encodeURIComponent(id)}`,
        token,
        {},
        { method: "DELETE" },
      ),
    importCatalogCsv: (token: string, csv: string) =>
      request<CatalogImportResponse>(
        "/v1/admin/catalog/imports",
        token,
        {},
        { method: "POST", body: { csv } },
      ),
  };
}

type CatalogGetPath =
  | "/v1/catalog/machine-types"
  | "/v1/catalog/brands"
  | "/v1/catalog/models"
  | "/v1/catalog/years"
  | "/v1/catalog/categories"
  | "/v1/catalog/parts/{code}"
  | "/v1/catalog/compatibilities";
type CatalogResponse<P extends CatalogGetPath> =
  paths[P]["get"]["responses"][200]["content"]["application/json"];

function withQuery(path: string, query: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "")
      search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export async function getHealth(baseUrl: string): Promise<HealthResponse> {
  return createApiClient({ baseUrl }).health();
}
