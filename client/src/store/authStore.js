import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: null,
  accessToken: null, // Stored in MEMORY only — never localStorage

  setAuth: (user, accessToken) => set({ user, accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
}));

export default useAuthStore;
