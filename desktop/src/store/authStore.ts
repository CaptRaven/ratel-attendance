import { create } from "zustand";
import type { User } from "@/lib/api";

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("ratel_token"),
  user: JSON.parse(localStorage.getItem("ratel_user") || "null"),

  setAuth: (token, user) => {
    localStorage.setItem("ratel_token", token);
    localStorage.setItem("ratel_user", JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem("ratel_token");
    localStorage.removeItem("ratel_user");
    set({ token: null, user: null });
  },
}));
