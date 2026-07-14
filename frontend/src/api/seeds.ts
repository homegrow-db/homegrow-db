import { api } from "./client";
import type { PaginatedResponse, Seed } from "../types";

export function getSeeds(params?: { strainId?: string; search?: string; sortBy?: string; sortOrder?: string; skip?: number; limit?: number }) {
  const query = new URLSearchParams();
  query.set("skip", String(params?.skip ?? 0));
  query.set("limit", String(params?.limit ?? 100));
  if (params?.strainId) query.set("strain_id", params.strainId);
  if (params?.search) query.set("search", params.search);
  if (params?.sortBy) query.set("sort_by", params.sortBy);
  if (params?.sortOrder) query.set("sort_order", params.sortOrder);
  return api.get<PaginatedResponse<Seed>>(`/seeds?${query}`);
}

export function getSeed(id: string) {
  return api.get<Seed>(`/seeds/${id}`);
}

export function createSeed(data: Partial<Seed>) {
  return api.post<Seed>("/seeds", data);
}

export function updateSeed(id: string, data: Partial<Seed>) {
  return api.patch<Seed>(`/seeds/${id}`, data);
}

export function deleteSeed(id: string) {
  return api.delete<void>(`/seeds/${id}`);
}
