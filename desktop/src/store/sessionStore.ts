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
    set((state) => {
      const exists = state.attendees.findIndex(
        (a) => a.employee_id === record.employee_id
      );
      if (exists !== -1) {
        const newAttendees = [...state.attendees];
        newAttendees[exists] = record;
        return { attendees: newAttendees };
      }
      return { attendees: [record, ...state.attendees] };
    }),

  clearSession: () => set({ session: null, qrToken: null, attendees: [] }),
}));
