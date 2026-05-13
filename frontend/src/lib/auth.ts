"use client";

import { create } from "zustand";

import { apiGet, apiPost, getToken, setToken } from "./api";
import type { AuthResponse, AuthUser } from "./types";

type AuthState = {
  user: AuthUser | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  hydrate: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<AuthUser>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ message: string }>;
  verifyOtp: (email: string, code: string) => Promise<{ message: string }>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",

  async hydrate() {
    const token = getToken();
    if (!token) {
      set({ status: "unauthenticated", user: null });
      return;
    }
    set({ status: "loading" });
    try {
      const user = await apiGet<AuthUser>("/api/auth/me");
      set({ user, status: "authenticated" });
    } catch {
      setToken(null);
      set({ user: null, status: "unauthenticated" });
    }
  },

  async refreshUser() {
    const token = getToken();
    if (!token) {
      set({ user: null, status: "unauthenticated" });
      return null;
    }
    try {
      const user = await apiGet<AuthUser>("/api/auth/me");
      set({ user, status: "authenticated" });
      return user;
    } catch {
      setToken(null);
      set({ user: null, status: "unauthenticated" });
      return null;
    }
  },

  async login(email, password) {
    const data = await apiPost<AuthResponse>("/api/auth/login", { email, password });
    setToken(data.token);
    set({ user: data.user, status: "authenticated" });
    return data.user;
  },

  async signup(name, email, password) {
    const data = await apiPost<AuthResponse>("/api/auth/signup", { name, email, password });
    setToken(data.token);
    set({ user: data.user, status: "authenticated" });
    return data.user;
  },

  async forgotPassword(email) {
    return apiPost<{ message: string }>("/api/auth/forgot-password", { email });
  },

  async resetPassword(email, code, newPassword) {
    return apiPost<{ message: string }>("/api/auth/reset-password", {
      email,
      code,
      new_password: newPassword,
    });
  },

  async verifyOtp(email, code) {
    return apiPost<{ message: string }>("/api/auth/verify-otp", { email, code });
  },

  logout() {
    setToken(null);
    set({ user: null, status: "unauthenticated" });
  },
}));
