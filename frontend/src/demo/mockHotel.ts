// Parte da hospedaria na demonstração: quartos, hóspedes e reservas de exemplo
// guardados no navegador. A automação Tuya (fechaduras/energia) é simulada:
// não há dispositivos reais, o resultado do check-in/check-out é fictício.
// Espelha src/routes/{rooms,guests,reservations}.ts e checkinService.ts.
import { ApiError } from "../api";

const STORE_KEY = "demo.hotel.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

interface Guest {
  id: string;
  fullName: string;
  document: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
}

interface Room {
  id: string;
  number: string;
  name: string | null;
  floor: string | null;
  status: string;
  tuyaDeviceId: string | null;
  tuyaCheckinCommands: string | null;
  tuyaCheckoutCommands: string | null;
}

interface Reservation {
  id: string;
  guestId: string;
  roomId: string;
  checkinDate: string;
  checkoutDate: string;
  actualCheckinAt: string | null;
  actualCheckoutAt: string | null;
  status: string;
  notes: string | null;
  lastAutomationResult: string | null;
}

interface HotelData {
  guests: Guest[];
  rooms: Room[];
  reservations: Reservation[];
}

const ON = JSON.stringify([{ code: "switch_1", value: true }]);
const OFF = JSON.stringify([{ code: "switch_1", value: false }]);

function buildHotelData(now = new Date()): HotelData {
  const today = new Date(now);
  today.setUTCHours(12, 0, 0, 0);
  const day = (n: number) => new Date(today.getTime() + n * DAY_MS).toISOString();
  const created = now.toISOString();

  const room = (id: string, number: string, name: string, floor: string, status: string, device: boolean): Room => ({
    id,
    number,
    name,
    floor,
    status,
    tuyaDeviceId: device ? `demo-fechadura-${number}` : null,
    tuyaCheckinCommands: device ? ON : null,
    tuyaCheckoutCommands: device ? OFF : null,
  });
  const rooms = [
    room("r-101", "101", "Standard", "1", "OCCUPIED", true),
    room("r-102", "102", "Standard", "1", "AVAILABLE", true),
    room("r-103", "103", "Duplo", "1", "AVAILABLE", true),
    room("r-201", "201", "Suite", "2", "OCCUPIED", true),
    room("r-202", "202", "Suite Master", "2", "AVAILABLE", true),
    room("r-203", "203", "Familiar", "2", "MAINTENANCE", false),
  ];

  const guest = (id: string, fullName: string, document: string, phone: string, email: string | null): Guest => ({
    id,
    fullName,
    document,
    phone,
    email,
    notes: null,
    createdAt: created,
  });
  const guests = [
    guest("g-1", "Ana Domingos", "BI 004512378LA041", "+244 923 456 789", "ana.domingos@exemplo.ao"),
    guest("g-2", "Carlos Mendes", "Passaporte N1234567", "+244 912 345 678", null),
    guest("g-3", "Joana Ferreira", "BI 007845123LA032", "+244 934 567 890", "joana.f@exemplo.ao"),
    guest("g-4", "Miguel Santos", "BI 002398745LA019", "+244 945 678 901", null),
    guest("g-5", "Teresa Lopes", "Passaporte P7654321", "+351 912 000 111", "teresa.lopes@exemplo.pt"),
  ];

  const automation = (phase: string, at: string) =>
    JSON.stringify({ phase, attempted: true, success: true, at, result: { simulated: true } });
  const reservation = (
    id: string,
    guestId: string,
    roomId: string,
    checkin: number,
    checkout: number,
    status: string,
  ): Reservation => ({
    id,
    guestId,
    roomId,
    checkinDate: day(checkin),
    checkoutDate: day(checkout),
    actualCheckinAt: status === "CHECKED_IN" || status === "CHECKED_OUT" ? day(checkin) : null,
    actualCheckoutAt: status === "CHECKED_OUT" ? day(checkout) : null,
    status,
    notes: null,
    lastAutomationResult:
      status === "CHECKED_IN" ? automation("checkin", day(checkin)) : status === "CHECKED_OUT" ? automation("checkout", day(checkout)) : null,
  });
  const reservations = [
    reservation("res-1", "g-1", "r-101", -2, 2, "CHECKED_IN"),
    reservation("res-2", "g-2", "r-201", -1, 3, "CHECKED_IN"),
    reservation("res-3", "g-3", "r-102", 0, 2, "BOOKED"),
    reservation("res-4", "g-4", "r-202", 1, 4, "BOOKED"),
    reservation("res-5", "g-5", "r-103", -6, -3, "CHECKED_OUT"),
    reservation("res-6", "g-4", "r-103", 5, 7, "CANCELLED"),
  ];

  return { guests, rooms, reservations };
}

let store: HotelData = load();

function load(): HotelData {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as HotelData;
  } catch {
    // dados ilegíveis ou armazenamento indisponível: recomeça
  }
  return buildHotelData();
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // sem armazenamento: as alterações duram até fechar a página
  }
}

export function resetHotelData() {
  store = buildHotelData();
  save();
}

function fail(status: number, message: string): never {
  throw new ApiError(message, status, { error: message });
}

const newId = () => `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function find<T extends { id: string }>(list: T[], id: string, label: string): T {
  const item = list.find((x) => x.id === id);
  if (!item) fail(404, `${label} não encontrado`);
  return item;
}

const withRelations = (r: Reservation) => ({
  ...r,
  guest: store.guests.find((g) => g.id === r.guestId),
  room: store.rooms.find((x) => x.id === r.roomId),
});

/** Simula o envio dos comandos Tuya ao dispositivo do quarto. */
function simulateAutomation(room: Room, phase: "checkin" | "checkout") {
  const commands = phase === "checkin" ? room.tuyaCheckinCommands : room.tuyaCheckoutCommands;
  if (!room.tuyaDeviceId || !commands || commands === "[]") return { attempted: false, success: true };
  return { attempted: true, success: true, result: { simulated: true, device: room.tuyaDeviceId, commands: JSON.parse(commands) } };
}

/** Responde às rotas /api/guests, /api/rooms, /api/reservations e /api/tuya; null se não for da hospedaria. */
export function handleHotel(pathname: string, method: string, body: Record<string, unknown>): unknown {
  const parts = pathname.replace(/^\/api\//, "").split("/");
  const [resource, id, action] = parts;
  const result = route(resource, id, action, method, body);
  if (method !== "GET") save();
  return result;
}

function route(resource: string, id: string | undefined, action: string | undefined, method: string, body: Record<string, unknown>) {
  if (resource === "tuya" && id === "status") return { connected: true, simulated: true };

  if (resource === "guests") {
    if (method === "GET" && !id) return [...store.guests].sort((a, b) => a.fullName.localeCompare(b.fullName));
    if (method === "POST") {
      if (String(body.fullName ?? "").trim().length < 2 || String(body.document ?? "").trim().length < 3) {
        fail(400, "Dados inválidos");
      }
      const g: Guest = {
        id: newId(),
        fullName: String(body.fullName),
        document: String(body.document),
        phone: (body.phone as string) || null,
        email: (body.email as string) || null,
        notes: null,
        createdAt: new Date().toISOString(),
      };
      store.guests.push(g);
      return g;
    }
    if (method === "DELETE" && id) {
      if (store.reservations.some((r) => r.guestId === id)) fail(400, "Hóspede tem reservas; remova-as primeiro");
      store.guests = store.guests.filter((g) => g.id !== id);
      return undefined;
    }
  }

  if (resource === "rooms") {
    if (method === "GET" && !id) return [...store.rooms].sort((a, b) => a.number.localeCompare(b.number));
    if (method === "GET" && action === "tuya-test") {
      const room = find(store.rooms, id as string, "Quarto");
      if (!room.tuyaDeviceId) fail(400, "Quarto sem dispositivo Tuya vinculado");
      return { info: { name: `Fechadura ${room.number} (simulada)`, online: true }, status: [] };
    }
    if (method === "POST") {
      if (!body.number) fail(400, "Dados inválidos");
      if (store.rooms.some((r) => r.number === body.number)) fail(409, "Já existe um quarto com este número");
      const room: Room = {
        id: newId(),
        number: String(body.number),
        name: (body.name as string) || null,
        floor: (body.floor as string) || null,
        status: (body.status as string) || "AVAILABLE",
        tuyaDeviceId: (body.tuyaDeviceId as string) || null,
        tuyaCheckinCommands: body.tuyaCheckinCommands ? JSON.stringify(body.tuyaCheckinCommands) : null,
        tuyaCheckoutCommands: body.tuyaCheckoutCommands ? JSON.stringify(body.tuyaCheckoutCommands) : null,
      };
      store.rooms.push(room);
      return room;
    }
    if (method === "PUT" && id) {
      const room = find(store.rooms, id, "Quarto");
      Object.assign(room, body);
      return room;
    }
    if (method === "DELETE" && id) {
      if (store.reservations.some((r) => r.roomId === id)) fail(400, "Quarto tem reservas; remova-as primeiro");
      store.rooms = store.rooms.filter((r) => r.id !== id);
      return undefined;
    }
  }

  if (resource === "reservations") {
    if (method === "GET" && !id) {
      return [...store.reservations]
        .sort((a, b) => b.checkinDate.localeCompare(a.checkinDate))
        .map(withRelations);
    }
    if (method === "POST" && !id) {
      const checkin = new Date(String(body.checkinDate));
      const checkout = new Date(String(body.checkoutDate));
      if (!body.guestId || !body.roomId || Number.isNaN(checkin.getTime()) || Number.isNaN(checkout.getTime())) {
        fail(400, "Dados inválidos");
      }
      if (checkout <= checkin) fail(400, "Data de check-out deve ser posterior à data de check-in");
      const r: Reservation = {
        id: newId(),
        guestId: String(body.guestId),
        roomId: String(body.roomId),
        checkinDate: checkin.toISOString(),
        checkoutDate: checkout.toISOString(),
        actualCheckinAt: null,
        actualCheckoutAt: null,
        status: "BOOKED",
        notes: (body.notes as string) || null,
        lastAutomationResult: null,
      };
      store.reservations.push(r);
      return withRelations(r);
    }
    if (method === "DELETE" && id) {
      store.reservations = store.reservations.filter((r) => r.id !== id);
      return undefined;
    }
    if (method === "POST" && id) {
      const r = find(store.reservations, id, "Reserva");
      const room = find(store.rooms, r.roomId, "Quarto");
      const now = new Date().toISOString();
      if (action === "cancel") {
        r.status = "CANCELLED";
        return withRelations(r);
      }
      if (action === "checkin") {
        if (r.status === "CHECKED_IN") fail(409, "Reserva já está com check-in realizado");
        if (r.status !== "BOOKED") fail(409, `Não é possível fazer check-in de uma reserva com status ${r.status}`);
        const automation = simulateAutomation(room, "checkin");
        room.status = "OCCUPIED";
        Object.assign(r, { status: "CHECKED_IN", actualCheckinAt: now, lastAutomationResult: JSON.stringify({ phase: "checkin", ...automation, at: now }) });
        return { reservation: withRelations(r), automation };
      }
      if (action === "checkout") {
        if (r.status !== "CHECKED_IN") fail(409, "Só é possível fazer check-out de uma reserva com check-in ativo");
        const automation = simulateAutomation(room, "checkout");
        room.status = "AVAILABLE";
        Object.assign(r, { status: "CHECKED_OUT", actualCheckoutAt: now, lastAutomationResult: JSON.stringify({ phase: "checkout", ...automation, at: now }) });
        return { reservation: withRelations(r), automation };
      }
    }
  }

  fail(404, "Rota não encontrada");
}
