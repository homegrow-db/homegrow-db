import { api } from "./client";
import type { PaginatedResponse, Strain } from "../types";

export function getStrains(skip = 0, limit = 100, search?: string, sortBy?: string, sortOrder?: string) {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (search) params.set("search", search);
  if (sortBy) params.set("sort_by", sortBy);
  if (sortOrder) params.set("sort_order", sortOrder);
  return api.get<PaginatedResponse<Strain>>(`/strains?${params}`);
}

export function getStrain(id: string) {
  return api.get<Strain>(`/strains/${id}`);
}

export function createStrain(data: Partial<Strain>) {
  return api.post<Strain>("/strains", data);
}

export function updateStrain(id: string, data: Partial<Strain>) {
  return api.patch<Strain>(`/strains/${id}`, data);
}

export function deleteStrain(id: string) {
  return api.delete<void>(`/strains/${id}`);
}

export function getStrainImageUrl(id: string) {
  const token = localStorage.getItem("token");
  return `http://localhost:8000/strains/${id}/image?token=${token}`;
}

export function uploadStrainImage(id: string, file: File) {
  return api.upload<{ id: string; file_path: string }>(
    `/strains/${id}/image`,
    file
  );
}
