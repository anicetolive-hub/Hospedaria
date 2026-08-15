import type { Guest, Reservation, Room, RoomInput } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (response.status === 204) return undefined as T;

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof body === "object" && body && "error" in body ? String(body.error) : String(body);
    throw new ApiError(message, response.status, body);
  }

  return body as T;
}

export const api = {
  guests: {
    list: () => request<Guest[]>("/api/guests"),
    create: (data: Partial<Guest>) => request<Guest>("/api/guests", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Guest>) =>
      request<Guest>(`/api/guests/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/api/guests/${id}`, { method: "DELETE" }),
  },
  rooms: {
    list: () => request<Room[]>("/api/rooms"),
    create: (data: RoomInput) => request<Room>("/api/rooms", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<RoomInput>) =>
      request<Room>(`/api/rooms/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/api/rooms/${id}`, { method: "DELETE" }),
    testTuya: (id: string) => request<unknown>(`/api/rooms/${id}/tuya-test`),
  },
  reservations: {
    list: (status?: string) => request<Reservation[]>(`/api/reservations${status ? `?status=${status}` : ""}`),
    create: (data: { guestId: string; roomId: string; checkinDate: string; checkoutDate: string; notes?: string }) =>
      request<Reservation>("/api/reservations", { method: "POST", body: JSON.stringify(data) }),
    cancel: (id: string) => request<Reservation>(`/api/reservations/${id}/cancel`, { method: "POST" }),
    remove: (id: string) => request<void>(`/api/reservations/${id}`, { method: "DELETE" }),
    checkIn: (id: string) =>
      request<{ reservation: Reservation; automation: unknown }>(`/api/reservations/${id}/checkin`, {
        method: "POST",
      }),
    checkOut: (id: string) =>
      request<{ reservation: Reservation; automation: unknown }>(`/api/reservations/${id}/checkout`, {
        method: "POST",
      }),
  },
  tuya: {
    status: () => request<{ connected: boolean; error?: string }>("/api/tuya/status"),
  },
};
