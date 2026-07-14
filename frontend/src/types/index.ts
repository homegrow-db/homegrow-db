export interface User {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
  avatar_path: string | null;
  totp_enabled: boolean;
  language: string;
  created_at: string;
}

export interface RegistrationStatus {
  registration_open: boolean;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface LoginResponse {
  access_token: string | null;
  temp_token: string | null;
  requires_2fa: boolean;
  token_type: string;
}

export interface TotpSetup {
  secret: string;
  uri: string;
  qr_code: string;
}

export interface Strain {
  id: string;
  user_id: string;
  name: string;
  breeder: string | null;
  genetics: string | null;
  genetic_origin: string | null;
  effects: string | null;
  aroma: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  flowering_weeks: number | null;
  description: string | null;
  seed_count: number;
  grow_count: number;
  created_at: string;
  updated_at: string;
}

export interface Seed {
  id: string;
  user_id: string;
  strain_id: string;
  quantity: number;
  purchase_date: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Grow {
  id: string;
  user_id: string;
  strain_id: string;
  seed_id: string | null;
  name: string;
  start_date: string;
  end_date: string | null;
  status: GrowStatus;
  medium: string | null;
  lighting: string | null;
  nutrients: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type GrowStatus =
  | "planned"
  | "ongoing"
  | "completed"
  | "failed";

export interface GrowEvent {
  id: string;
  user_id: string;
  grow_id: string;
  event_date: string;
  event_type: GrowEventType;
  description: string | null;
  created_at: string;
}

export type GrowEventType =
  | "seed_sowing"
  | "germination"
  | "seedling"
  | "vegetative"
  | "flowering_start"
  | "flowering"
  | "harvest"
  | "drying"
  | "curing"
  | "note";

export interface GrowWeek {
  id: string;
  grow_id: string;
  week_number: number;
  notes: string | null;
  fertilizer: string | null;
  watering: string | null;
  light_intensity: string | null;
  light_cycle: string | null;
  temperature: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowHarvest {
  id: string;
  grow_id: string;
  harvest_date: string;
  weight: number | null;
  notes: string | null;
  created_at: string;
}

export interface GrowImage {
  id: string;
  user_id: string;
  grow_id: string | null;
  grow_event_id: string | null;
  grow_week_id: string | null;
  grow_harvest_id: string | null;
  strain_id: string | null;
  seed_id: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  is_primary: boolean;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}
