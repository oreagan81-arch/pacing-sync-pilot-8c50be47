import { create } from 'zustand';

interface SystemState {
  activeQuarter: string;
  activeWeek: number;
  setActiveQuarter: (quarter: string) => void;
  setActiveWeek: (week: number) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  activeQuarter: 'Q1', // Default, will be overridden by URL params later
  activeWeek: 1,
  setActiveQuarter: (quarter) => set({ activeQuarter: quarter }),
  setActiveWeek: (week) => set({ activeWeek: week }),
}));
