import { prisma } from "../lib/prisma";
import { parseTuyaCommands, sendDeviceCommands } from "./tuyaService";

export interface AutomationOutcome {
  attempted: boolean;
  success: boolean;
  error?: string;
  result?: unknown;
}

async function runRoomAutomation(
  room: { tuyaDeviceId: string | null; tuyaCheckinCommands: string | null; tuyaCheckoutCommands: string | null },
  phase: "checkin" | "checkout",
): Promise<AutomationOutcome> {
  const commandsJson = phase === "checkin" ? room.tuyaCheckinCommands : room.tuyaCheckoutCommands;
  const commands = parseTuyaCommands(commandsJson);

  if (!room.tuyaDeviceId || commands.length === 0) {
    return { attempted: false, success: true };
  }

  try {
    const result = await sendDeviceCommands(room.tuyaDeviceId, commands);
    return { attempted: true, success: true, result };
  } catch (err) {
    return { attempted: true, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function performCheckIn(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true, guest: true },
  });

  if (!reservation) {
    throw Object.assign(new Error("Reserva não encontrada"), { status: 404 });
  }
  if (reservation.status === "CHECKED_IN") {
    throw Object.assign(new Error("Reserva já está com check-in realizado"), { status: 409 });
  }
  if (reservation.status === "CANCELLED" || reservation.status === "CHECKED_OUT") {
    throw Object.assign(new Error(`Não é possível fazer check-in de uma reserva com status ${reservation.status}`), {
      status: 409,
    });
  }

  // O check-in físico/administrativo é confirmado independentemente do resultado
  // da automação — se a nuvem Tuya estiver indisponível, a recepção ainda pode
  // liberar o hóspede manualmente e reenviar o comando depois.
  const automation = await runRoomAutomation(reservation.room, "checkin");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.room.update({
      where: { id: reservation.roomId },
      data: { status: "OCCUPIED" },
    });

    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CHECKED_IN",
        actualCheckinAt: new Date(),
        lastAutomationResult: JSON.stringify({ phase: "checkin", ...automation, at: new Date().toISOString() }),
      },
      include: { room: true, guest: true },
    });
  });

  return { reservation: updated, automation };
}

export async function performCheckOut(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true, guest: true },
  });

  if (!reservation) {
    throw Object.assign(new Error("Reserva não encontrada"), { status: 404 });
  }
  if (reservation.status !== "CHECKED_IN") {
    throw Object.assign(new Error("Só é possível fazer check-out de uma reserva com check-in ativo"), {
      status: 409,
    });
  }

  const automation = await runRoomAutomation(reservation.room, "checkout");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.room.update({
      where: { id: reservation.roomId },
      data: { status: "AVAILABLE" },
    });

    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CHECKED_OUT",
        actualCheckoutAt: new Date(),
        lastAutomationResult: JSON.stringify({ phase: "checkout", ...automation, at: new Date().toISOString() }),
      },
      include: { room: true, guest: true },
    });
  });

  return { reservation: updated, automation };
}
