import { create } from "zustand";

type Role = "learner" | "instructor" | "admin";

type State = {
  role: Role;
  selectedLearnerId: string | null;
  setRole: (r: Role) => void;
  setSelectedLearnerId: (id: string | null) => void;
};

export const useAppStore = create<State>((set) => ({
  role: "learner",
  selectedLearnerId: null,
  setRole: (r) => set({ role: r }),
  setSelectedLearnerId: (id) => set({ selectedLearnerId: id }),
}));
