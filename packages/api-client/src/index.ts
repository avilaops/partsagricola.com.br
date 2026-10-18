import type { paths } from "./schema.ts";

export type HealthResponse =
  paths["/v1/health"]["get"]["responses"][200]["content"]["application/json"];
export type SessionResponse =
  paths["/v1/session"]["get"]["responses"][200]["content"]["application/json"];
export type ApiModule =
  | "catalog"
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
export type CompanyApplicationInput =
  paths["/v1/sellers/applications"]["post"]["requestBody"]["content"]["application/json"];
export type CompanyApplicationResponse =
  paths["/v1/sellers/applications"]["post"]["responses"][201]["content"]["application/json"];
export type PartRequestInput =
  paths["/v1/requests"]["post"]["requestBody"]["content"]["application/json"];
export type PartRequestResponse =
  paths["/v1/requests"]["post"]["responses"][201]["content"]["application/json"];
export type SellerDashboardResponse =
  paths["/v1/sellers/dashboard"]["get"]["responses"][200]["content"]["application/json"];
export type ReferenceDataResponse =
  paths["/v1/catalog/reference-data"]["get"]["responses"][200]["content"]["application/json"];
export type PublicCatalogResponse =
  paths["/v1/marketplace/listings"]["get"]["responses"][200]["content"]["application/json"];
export type PublicListingResponse =
  paths["/v1/marketplace/listings/{id}"]["get"]["responses"][200]["content"]["application/json"];
export type PublicSellerResponse =
  paths["/v1/marketplace/sellers/{slug}"]["get"]["responses"][200]["content"]["application/json"];
export type ListingInput =
  paths["/v1/sellers/listings"]["post"]["requestBody"]["content"]["application/json"];
export type SellerListingsResponse =
  paths["/v1/sellers/listings"]["get"]["responses"][200]["content"]["application/json"];
export type InterestsResponse =
  paths["/v1/account/interests"]["get"]["responses"][200]["content"]["application/json"];

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
    referenceData: (token: string) =>
      request<ReferenceDataResponse>("/v1/catalog/reference-data", token),
    createCompanyApplication: (token: string, body: CompanyApplicationInput) =>
      request<CompanyApplicationResponse>(
        "/v1/sellers/applications",
        token,
        {},
        { method: "POST", body },
      ),
    createPartRequest: (token: string, body: PartRequestInput) =>
      request<PartRequestResponse>(
        "/v1/requests",
        token,
        {},
        { method: "POST", body },
      ),
    sellerDashboard: (token: string, sellerId: string) =>
      request<SellerDashboardResponse>("/v1/sellers/dashboard", token, {
        "x-seller-id": sellerId,
      }),
    updateSellerProfile: (
      token: string,
      sellerId: string,
      body: paths["/v1/sellers/profile"]["patch"]["requestBody"]["content"]["application/json"],
    ) =>
      request<
        paths["/v1/sellers/profile"]["patch"]["responses"][200]["content"]["application/json"]
      >(
        "/v1/sellers/profile",
        token,
        { "x-seller-id": sellerId },
        { method: "PATCH", body },
      ),
    publicCatalog: (
      filters: {
        query?: string | undefined;
        categoryId?: string | undefined;
        brandId?: string | undefined;
        stateCode?: string | undefined;
        categorySlug?: string | undefined;
        brandSlug?: string | undefined;
      } = {},
    ) => {
      const url = new URL("/v1/marketplace/listings", input.baseUrl);
      for (const [key, value] of Object.entries(filters))
        if (value) url.searchParams.set(key, value);
      return request<PublicCatalogResponse>(`${url.pathname}${url.search}`);
    },
    publicSeller: (slug: string) =>
      request<PublicSellerResponse>(
        `/v1/marketplace/sellers/${encodeURIComponent(slug)}`,
      ),
    publicListing: (id: string) =>
      request<PublicListingResponse>(
        `/v1/marketplace/listings/${encodeURIComponent(id)}`,
      ),
    favorites: (token: string) =>
      request<
        paths["/v1/account/favorites"]["get"]["responses"][200]["content"]["application/json"]
      >("/v1/account/favorites", token),
    addFavorite: (token: string, listingId: string) =>
      request(
        `/v1/marketplace/listings/${encodeURIComponent(listingId)}/favorite`,
        token,
        {},
        { method: "POST" },
      ),
    removeFavorite: (token: string, listingId: string) =>
      request(
        `/v1/marketplace/listings/${encodeURIComponent(listingId)}/favorite`,
        token,
        {},
        { method: "DELETE" },
      ),
    publicTaxonomy: () =>
      request<
        paths["/v1/marketplace/taxonomy"]["get"]["responses"][200]["content"]["application/json"]
      >("/v1/marketplace/taxonomy"),
    sellerListings: (token: string, sellerId: string) =>
      request<SellerListingsResponse>("/v1/sellers/listings", token, {
        "x-seller-id": sellerId,
      }),
    createListing: (token: string, sellerId: string, body: ListingInput) =>
      request<{ id: string; status: "PENDING_REVIEW" }>(
        "/v1/sellers/listings",
        token,
        { "x-seller-id": sellerId },
        { method: "POST", body },
      ),
    createInterest: (token: string, listingId: string, message?: string) =>
      request<{ id: string; status: "OPEN" }>(
        `/v1/marketplace/listings/${encodeURIComponent(listingId)}/interests`,
        token,
        {},
        { method: "POST", body: message ? { message } : {} },
      ),
    buyerInterests: (token: string) =>
      request<InterestsResponse>("/v1/account/interests", token),
    sellerInterests: (token: string, sellerId: string) =>
      request<InterestsResponse>("/v1/sellers/interests", token, {
        "x-seller-id": sellerId,
      }),
    createSellerProposal: (
      token: string,
      sellerId: string,
      interestId: string,
      body: { amountMinor?: number | undefined; terms: string },
    ) =>
      request<{ id: string; status: "SENT" }>(
        `/v1/sellers/interests/${encodeURIComponent(interestId)}/proposals`,
        token,
        { "x-seller-id": sellerId },
        { method: "POST", body },
      ),
    decideProposal: (
      token: string,
      proposalId: string,
      decision: "ACCEPTED" | "REJECTED",
    ) =>
      request<{ id: string; status: "ACCEPTED" | "REJECTED" }>(
        `/v1/account/proposals/${encodeURIComponent(proposalId)}/decision`,
        token,
        {},
        { method: "POST", body: { decision } },
      ),
    createReview: (
      token: string,
      proposalId: string,
      body: { rating: number; comment?: string | undefined },
    ) =>
      request<{ id: string; status: "PUBLISHED" }>(
        `/v1/account/proposals/${encodeURIComponent(proposalId)}/review`,
        token,
        {},
        { method: "POST", body },
      ),
    adminModeration: (token: string) =>
      request<
        paths["/v1/admin/moderation"]["get"]["responses"][200]["content"]["application/json"]
      >("/v1/admin/moderation", token),
    moderate: (
      token: string,
      entity: "company" | "listing",
      id: string,
      decision: "APPROVED" | "PUBLISHED" | "REJECTED",
    ) =>
      request<{ id: string; status: string }>(
        `/v1/admin/moderation/${entity}/${encodeURIComponent(id)}`,
        token,
        {},
        { method: "POST", body: { decision } },
      ),
    report: (
      token: string,
      body: {
        entityType: "COMPANY" | "LISTING" | "REVIEW";
        entityId: string;
        reason: string;
      },
    ) =>
      request<{ id: string; status: "OPEN" }>(
        "/v1/moderation/reports",
        token,
        {},
        { method: "POST", body },
      ),
    resolveModerationCase: (
      token: string,
      id: string,
      decision: "RESOLVED" | "DISMISSED",
      resolution: string,
    ) =>
      request<{ id: string; status: string }>(
        `/v1/admin/moderation/cases/${encodeURIComponent(id)}`,
        token,
        {},
        { method: "POST", body: { decision, resolution } },
      ),
  };
}

export async function getHealth(baseUrl: string): Promise<HealthResponse> {
  return createApiClient({ baseUrl }).health();
}
