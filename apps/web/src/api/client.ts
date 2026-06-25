import type {
  Adjustment,
  Balance,
  Count,
  CountLine,
  Invoice,
  Item,
  Location,
  Movement,
  Period,
  POLine,
  PurchaseOrder,
  Recipe,
  RecipeYield,
  SalesImport,
  Supplier,
  Transfer,
  User,
} from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

const TOKEN_KEY = "ics_token";
export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearAuthToken = () => localStorage.removeItem(TOKEN_KEY);

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // An expired/invalid session anywhere (except the login call) bounces to login.
  if (res.status === 401 && path !== "/auth/login") {
    clearAuthToken();
    window.location.reload();
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON response — usually an HTML error page because the API/database
      // isn't reachable. Surface a clear message instead of a JSON parse error.
      throw new ApiError(
        res.status,
        res.ok
          ? "The server returned an unexpected (non-JSON) response."
          : `Couldn't reach the API (HTTP ${res.status}). Is the API server and database running?`,
        text.slice(0, 300),
      );
    }
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data
        ? typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error)
        : null) ?? `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

const get = <T>(path: string) => req<T>("GET", path);
const post = <T>(path: string, body?: unknown) => req<T>("POST", path, body ?? {});
const put = <T>(path: string, body?: unknown) => req<T>("PUT", path, body ?? {});

export interface AppSettings {
  businessName: string;
  currency: string;
  defaultLocationId: string | null;
  countTolerancePct: number;
  allowNegativeStock: boolean;
  requireApprovalForVariances: boolean;
  tutorialEnabled: boolean;
}
export interface Category {
  id: string;
  name: string;
}

export const api = {
  // auth
  login: (email: string, password: string) =>
    post<{ token: string; user: { id: string; name: string; email: string } }>("/auth/login", {
      email,
      password,
    }),
  me: () => get<{ user: { id: string; name: string }; permissions: string[] }>("/auth/me"),
  changePassword: (b: { currentPassword: string; newPassword: string }) =>
    put<{ ok: boolean }>("/auth/password", b),

  // reference data
  balances: () => get<Balance[]>("/balances"),
  balancesCache: () => get<Balance[]>("/balances/cache"),
  rebuildBalances: () => post<{ rebuilt: boolean }>("/balances/rebuild"),
  items: () => get<Item[]>("/items"),
  locations: () => get<Location[]>("/locations"),
  users: () => get<User[]>("/users"),

  // movements
  movements: (query = "") => get<Movement[]>(`/movements${query}`),
  recordMovement: (b: unknown) => post<Movement>("/movements", b),

  // transfers
  transfers: () => get<Transfer[]>("/transfers"),
  transfer: (id: string) => get<Transfer & { lines: unknown[] }>(`/transfers/${id}`),
  createTransfer: (b: unknown) => post<Transfer>("/transfers", b),
  confirmTransfer: (id: string, b?: unknown) => post<Transfer>(`/transfers/${id}/confirm`, b),

  // purchasing
  suppliers: () => get<Supplier[]>("/suppliers"),
  createSupplier: (b: unknown) => post<Supplier>("/suppliers", b),
  purchaseOrders: () => get<PurchaseOrder[]>("/purchase-orders"),
  purchaseOrder: (id: string) => get<PurchaseOrder & { lines: POLine[] }>(`/purchase-orders/${id}`),
  createPO: (b: unknown) => post<PurchaseOrder>("/purchase-orders", b),
  approvePO: (id: string, b?: unknown) => post<PurchaseOrder>(`/purchase-orders/${id}/approve`, b),
  receiveGoods: (b: unknown) => post<{ grnId: string; poStatus: string | null }>("/goods-receipts", b),
  invoices: () => get<Invoice[]>("/invoices"),
  recordInvoice: (b: unknown) => post<Invoice>("/invoices", b),

  // counts / adjustments / periods
  counts: () => get<Count[]>("/counts"),
  count: (id: string) => get<Count & { lines: CountLine[] }>(`/counts/${id}`),
  createCount: (b: unknown) => post<Count>("/counts", b),
  submitCountLines: (id: string, b: unknown) => post<{ submitted: number }>(`/counts/${id}/lines`, b),
  postCount: (id: string, b?: unknown) =>
    post<{ countId: string; variances: CountVariance[] }>(`/counts/${id}/post`, b),
  adjustments: (query = "") => get<Adjustment[]>(`/adjustments${query}`),
  approveAdjustment: (id: string, b?: unknown) => post<Adjustment>(`/adjustments/${id}/approve`, b),
  rejectAdjustment: (id: string, b?: unknown) => post<Adjustment>(`/adjustments/${id}/reject`, b),
  periods: () => get<Period[]>("/periods"),
  createPeriod: (b: unknown) => post<Period>("/periods", b),
  closePeriod: (id: string, b?: unknown) => post<Period>(`/periods/${id}/close`, b),

  // recipes / sales
  recipes: () => get<Recipe[]>("/recipes"),
  recipe: (id: string) => get<Recipe & { components: unknown[] }>(`/recipes/${id}`),
  recipeYield: (id: string) => get<RecipeYield>(`/recipes/${id}/yield`),
  createRecipe: (b: unknown) => post<Recipe>("/recipes", b),
  salesImports: () => get<SalesImport[]>("/sales-imports"),
  ingestSales: (b: unknown) =>
    post<{ salesImportId: string; depletions: { itemId: string; baseQty: number }[] }>(
      "/sales-imports",
      b,
    ),

  // reports
  reportValuation: () => get<Record<string, string | null>[]>("/reports/valuation"),
  reportReorder: () => get<Record<string, string | null>[]>("/reports/reorder"),
  reportVariance: () => get<Record<string, string | null>[]>("/reports/variance"),
  reportExpiry: (days = 30) => get<Record<string, string | null>[]>(`/reports/expiry?days=${days}`),
  reportActivity: () => get<Record<string, string | number | null>[]>("/reports/activity"),
  reportLots: () => get<Record<string, string | boolean | null>[]>("/reports/lots"),

  // settings & management
  settings: () => get<AppSettings>("/settings"),
  updateSettings: (b: Partial<AppSettings>) => put<AppSettings>("/settings", b),
  categories: () => get<Category[]>("/categories"),
  createCategory: (b: unknown) => post<Category>("/categories", b),
  createLocation: (b: unknown) => post<Location>("/locations", b),
  createItem: (b: unknown) => post<Item>("/items", b),
  setItemCost: (id: string, b: { cost: number; unitCode: string }) =>
    put<{ ok: boolean; costPerBase: number }>(`/items/${id}/cost`, b),

  // file upload (multipart)
  uploadAttachment: async (file: File): Promise<{ id: string; url: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    const token = getAuthToken();
    const res = await fetch("/api/attachments", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (res.status === 401) {
      clearAuthToken();
      window.location.reload();
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new ApiError(res.status, (data && data.error) || "upload failed", data);
    }
    return data as { id: string; url: string };
  },
};

export interface CountVariance {
  itemId: string;
  counted: number;
  expected: number;
  variance: number;
  withinTolerance: boolean;
  adjustmentId: string | null;
}
