export type RoomStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
export type ReservationStatus = "BOOKED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";

export interface TuyaCommand {
  code: string;
  value: string | number | boolean;
}

export interface Guest {
  id: string;
  fullName: string;
  document: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Room {
  id: string;
  number: string;
  name?: string | null;
  floor?: string | null;
  status: RoomStatus;
  tuyaDeviceId?: string | null;
  tuyaCheckinCommands?: string | null;
  tuyaCheckoutCommands?: string | null;
}

export interface Reservation {
  id: string;
  guestId: string;
  roomId: string;
  checkinDate: string;
  checkoutDate: string;
  actualCheckinAt?: string | null;
  actualCheckoutAt?: string | null;
  status: ReservationStatus;
  notes?: string | null;
  lastAutomationResult?: string | null;
  guest: Guest;
  room: Room;
}

export interface RoomInput {
  number: string;
  name?: string;
  floor?: string;
  status?: RoomStatus;
  tuyaDeviceId?: string;
  tuyaCheckinCommands?: TuyaCommand[];
  tuyaCheckoutCommands?: TuyaCommand[];
}

export interface AutomationOutcome {
  attempted: boolean;
  success: boolean;
  error?: string;
  result?: unknown;
}

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  BOOKED: "Reservada",
  CHECKED_IN: "Hospedado",
  CHECKED_OUT: "Saída feita",
  CANCELLED: "Cancelada",
};

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  AVAILABLE: "Disponível",
  OCCUPIED: "Ocupado",
  MAINTENANCE: "Manutenção",
};
