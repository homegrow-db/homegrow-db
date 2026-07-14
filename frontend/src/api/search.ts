import { api } from "./client";
import type { Grow, Strain } from "../types";

export interface SearchResults {
  strains: Strain[];
  grows: Grow[];
  total_strains: number;
  total_grows: number;
}

export function globalSearch(q: string, skip = 0, limit = 20) {
  const params = new URLSearchParams({ q, skip: String(skip), limit: String(limit) });
  return api.get<SearchResults>(`/search?${params}`);
}
