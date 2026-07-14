import { api } from "./client";
import type { Grow, GrowEvent, GrowHarvest, GrowImage, GrowWeek, PaginatedResponse } from "../types";

export function getGrows(status?: string, skip = 0, limit = 100) {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (status) params.set("status", status);
  return api.get<PaginatedResponse<Grow>>(`/grows?${params}`);
}

export function getGrow(id: string) {
  return api.get<Grow>(`/grows/${id}`);
}

export function createGrow(data: Partial<Grow>) {
  return api.post<Grow>("/grows", data);
}

export function updateGrow(id: string, data: Partial<Grow>) {
  return api.patch<Grow>(`/grows/${id}`, data);
}

export function deleteGrow(id: string) {
  return api.delete<void>(`/grows/${id}`);
}

export function getGrowEvents(growId: string) {
  return api.get<GrowEvent[]>(`/grows/${growId}/events`);
}

export function createGrowEvent(growId: string, data: Partial<GrowEvent>) {
  return api.post<GrowEvent>(`/grows/${growId}/events`, data);
}

export function uploadGrowImage(growId: string, file: File) {
  return api.upload<{ id: string }>(`/grows/${growId}/images`, file);
}

export function getGrowWeeks(growId: string) {
  return api.get<GrowWeek[]>(`/grows/${growId}/weeks`);
}

export function createGrowWeek(growId: string, data: Partial<GrowWeek>) {
  return api.post<GrowWeek>(`/grows/${growId}/weeks`, data);
}

export function updateGrowWeek(growId: string, weekId: string, data: Partial<GrowWeek>) {
  return api.patch<GrowWeek>(`/grows/${growId}/weeks/${weekId}`, data);
}

export function deleteGrowWeek(growId: string, weekId: string) {
  return api.delete<void>(`/grows/${growId}/weeks/${weekId}`);
}

export function getGrowHarvest(growId: string) {
  return api.get<GrowHarvest>(`/grows/${growId}/harvest`);
}

export function createGrowHarvest(growId: string, data: Partial<GrowHarvest>) {
  return api.post<GrowHarvest>(`/grows/${growId}/harvest`, data);
}

export function updateGrowHarvest(growId: string, data: Partial<GrowHarvest>) {
  return api.patch<GrowHarvest>(`/grows/${growId}/harvest`, data);
}

export function deleteGrowHarvest(growId: string) {
  return api.delete<void>(`/grows/${growId}/harvest`);
}

export function uploadGrowWeekImage(growId: string, weekId: string, file: File) {
  return api.upload<GrowImage>(`/grows/${growId}/weeks/${weekId}/images`, file);
}

export function uploadGrowHarvestImage(growId: string, file: File) {
  return api.upload<GrowImage>(`/grows/${growId}/harvest/images`, file);
}

export function getGrowImages(growId: string) {
  return api.get<GrowImage[]>(`/grows/${growId}/images`);
}

export function getGrowImageUrl(imageId: string) {
  const token = localStorage.getItem("token");
  return `/grows/images/${imageId}?token=${token}`;
}

export function getGrowCoverUrl(growId: string) {
  const token = localStorage.getItem("token");
  return `/grows/${growId}/cover?token=${token}`;
}
