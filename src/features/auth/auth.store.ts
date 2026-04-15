import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import type { User } from "./auth.schema";

interface AuthStore {
	user: User | null;
	session: Session | null;
	isAuthenticated: boolean;
	setUser: (user: User | null) => void;
	setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
	user: null,
	session: null,
	isAuthenticated: false,
	setUser: (user) => set({ user, isAuthenticated: user !== null }),
	setSession: (session) => set({ session, isAuthenticated: !!session }),
}));
