import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { performCheckIn, performCheckOut } from "../services/checkinService";

export const reservationsRouter = Router();

const reservationSchema = z.object({
  guestId: z.string().min(1),
  roomId: z.string().min(1),
  checkinDate: z.coerce.date(),
  checkoutDate: z.coerce.date(),
  notes: z.string().optional(),
});

reservationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const reservations = await prisma.reservation.findMany({
      where: status ? { status: status as any } : undefined,
      include: { guest: true, room: true },
      orderBy: { checkinDate: "desc" },
    });
    res.json(reservations);
  }),
);

reservationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: { guest: true, room: true },
    });
    if (!reservation) return res.status(404).json({ error: "Reserva não encontrada" });
    res.json(reservation);
  }),
);

reservationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = reservationSchema.parse(req.body);
    if (data.checkoutDate <= data.checkinDate) {
      return res.status(400).json({ error: "Data de check-out deve ser posterior à data de check-in" });
    }
    const reservation = await prisma.reservation.create({
      data,
      include: { guest: true, room: true },
    });
    res.status(201).json(reservation);
  }),
);

reservationsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = reservationSchema.partial().parse(req.body);
    const reservation = await prisma.reservation.update({
      where: { id: req.params.id },
      data,
      include: { guest: true, room: true },
    });
    res.json(reservation);
  }),
);

reservationsRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const reservation = await prisma.reservation.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
      include: { guest: true, room: true },
    });
    res.json(reservation);
  }),
);

reservationsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.reservation.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

/**
 * Rota central da automação: ao confirmar o check-in, aciona os comandos
 * Tuya configurados para o quarto (ex: destrancar fechadura, ligar energia).
 */
reservationsRouter.post(
  "/:id/checkin",
  asyncHandler(async (req, res) => {
    const result = await performCheckIn(req.params.id);
    res.json(result);
  }),
);

reservationsRouter.post(
  "/:id/checkout",
  asyncHandler(async (req, res) => {
    const result = await performCheckOut(req.params.id);
    res.json(result);
  }),
);
