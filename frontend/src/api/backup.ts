import { api } from "./client";

const API_BASE = "";

export interface BackupCounts {
  strains: number;
  seeds: number;
  grows: number;
  grow_weeks: number;
  grow_harvests: number;
  grow_events: number;
  grow_images: number;
}

export interface BackupImportResult {
  restored: boolean;
  avatar_restored: boolean;
  counts: BackupCounts;
}

export async function exportBackup(): Promise<Blob> {
  const token = localStorage.getItem("token");
  const resp = await fetch(`${API_BASE}/backup/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) {
    let msg = `Export failed (${resp.status})`;
    try {
      const body = await resp.json();
      if (body.detail) msg = body.detail;
    } catch {
      const text = await resp.text().catch(() => "");
      if (text) msg = text.slice(0, 200);
    }
    throw new Error(msg);
  }
  return resp.blob();
}

export function importBackup(file: File) {
  return api.upload<BackupImportResult>("/backup/import", file);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}