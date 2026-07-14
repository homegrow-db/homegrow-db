import { api } from "./client";
import type { LoginResponse, RegistrationStatus, Token, TotpSetup, User } from "../types";

export function login(username: string, password: string) {
  return api.post<LoginResponse>("/auth/login", { username, password });
}

export function verify2fa(code: string) {
  return api.post<Token>("/auth/verify-2fa", { code });
}

export function register(email: string, username: string, password: string) {
  return api.post<User>("/auth/register", { email, username, password });
}

export function getMe() {
  return api.get<User>("/auth/me");
}

export function updateProfile(data: {
  email?: string;
  username?: string;
  password?: string;
  language?: string;
}) {
  return api.put<User>("/auth/me", data);
}

export function getAvatarUrl() {
  const token = localStorage.getItem("token");
  return `/auth/me/avatar?token=${token}`;
}

export function uploadAvatar(file: File) {
  return api.upload<User>("/auth/me/avatar", file);
}

export function getTotpStatus() {
  return api.get<{ totp_enabled: boolean; has_secret: boolean }>("/auth/totp/status");
}

export function setupTotp() {
  return api.post<TotpSetup>("/auth/totp/setup");
}

export function enableTotp(code: string) {
  return api.post<{ success: boolean; message: string }>("/auth/totp/enable", { code });
}

export function disableTotp(password: string) {
  return api.post<{ success: boolean; message: string }>("/auth/totp/disable", { password });
}

export function getRegistrationStatus() {
  return api.get<RegistrationStatus>("/auth/registration-status");
}

export function setRegistrationStatus(open: boolean) {
  return api.put<RegistrationStatus>("/auth/registration-status", { registration_open: open });
}
