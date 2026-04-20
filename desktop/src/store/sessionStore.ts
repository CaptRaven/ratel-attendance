import { create } from "zustand";
import type { Session, AttendanceRecord } from "@/lib/api";

interface SessionState {
  session: Session | null;
  qrToken: string | null;
  attendees: AttendanceRecord[];
  setSession: (session: Session) => void;
  setQrToken: (token: string) => void;
  addAttendee: (record: AttendanceRecord) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  qrToken: null,
  attendees: [],

  setSession: (session) =>
    set({ session, qrToken: session.qr_token, attendees: [] }),

  setQrToken: (token) => set({ qrToken: token }),

  addAttendee: (record) =>
    set((state) => ({
      attendees: [record, ...state.attendees],
    })),

  clearSession: () => set({ session: null, qrToken: null, attendees: [] }),
}));
