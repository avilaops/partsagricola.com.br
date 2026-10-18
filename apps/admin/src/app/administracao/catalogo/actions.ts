"use server";

import {
  ApiClientError,
  createApiClient,
  type CatalogAdminEntity,
  type CatalogAdminRecord,
} from "@partsagricola/api-client";
import { cookies } from "next/headers";

export type CatalogActionResult =
  | { ok: true; record?: CatalogAdminRecord; message: string }
  | { ok: false; message: string };

async function authorizedClient() {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token) throw new Error("Sessão administrativa ausente");
  return {
    token,
    client: createApiClient({
      baseUrl: process.env.API_ORIGIN ?? "http://localhost:4100",
    }),
  };
}

function failure(error: unknown): CatalogActionResult {
  return {
    ok: false,
    message:
      error instanceof ApiClientError || error instanceof Error
        ? error.message
        : "Não foi possível concluir a operação",
  };
}

export async function createPartAction(
  body: CatalogAdminRecord,
): Promise<CatalogActionResult> {
  try {
    const { client, token } = await authorizedClient();
    const record = await client.createCatalogAdmin("parts", token, body);
    return { ok: true, record, message: "Peça cadastrada" };
  } catch (error) {
    return failure(error);
  }
}

export async function createCatalogEntityAction(
  entity: CatalogAdminEntity,
  body: CatalogAdminRecord,
): Promise<CatalogActionResult> {
  try {
    const { client, token } = await authorizedClient();
    const record = await client.createCatalogAdmin(entity, token, body);
    return { ok: true, record, message: "Referência cadastrada" };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePartAction(
  id: string,
  body: CatalogAdminRecord,
): Promise<CatalogActionResult> {
  try {
    const { client, token } = await authorizedClient();
    const record = await client.updateCatalogAdmin("parts", id, token, body);
    return { ok: true, record, message: "Alterações salvas" };
  } catch (error) {
    return failure(error);
  }
}

export async function updateCatalogEntityAction(
  entity: CatalogAdminEntity,
  id: string,
  body: CatalogAdminRecord,
): Promise<CatalogActionResult> {
  try {
    const { client, token } = await authorizedClient();
    const record = await client.updateCatalogAdmin(entity, id, token, body);
    return { ok: true, record, message: "Alterações salvas" };
  } catch (error) {
    return failure(error);
  }
}

export async function deactivatePartAction(
  id: string,
): Promise<CatalogActionResult> {
  try {
    const { client, token } = await authorizedClient();
    const record = await client.deactivateCatalogAdmin("parts", id, token);
    return { ok: true, record, message: "Peça desativada" };
  } catch (error) {
    return failure(error);
  }
}

export async function deactivateCatalogEntityAction(
  entity: CatalogAdminEntity,
  id: string,
): Promise<CatalogActionResult> {
  try {
    const { client, token } = await authorizedClient();
    const record = await client.deactivateCatalogAdmin(entity, id, token);
    return { ok: true, record, message: "Referência desativada" };
  } catch (error) {
    return failure(error);
  }
}

export async function importCatalogAction(
  csv: string,
): Promise<CatalogActionResult> {
  try {
    const { client, token } = await authorizedClient();
    const result = await client.importCatalogCsv(token, csv);
    return {
      ok: true,
      message: `${result.rows} ${result.rows === 1 ? "linha importada" : "linhas importadas"}`,
    };
  } catch (error) {
    return failure(error);
  }
}
