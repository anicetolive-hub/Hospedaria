import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";

export const guestsRouter = Router();

const guestSchema = z.object({
  fullName: z.string().min(2),
  document: z.string().min(3),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});

guestsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const guests = await prisma.guest.findMany({ orderBy: { fullName: "asc" } });
    res.json(guests);
  }),
);

guestsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const guest = await prisma.guest.findUnique({
      where: { id: req.params.id },
      include: { reservations: { include: { room: true }, orderBy: { checkinDate: "desc" } } },
    });
    if (!guest) return res.status(404).json({ error: "Hóspede não encontrado" });
    res.json(guest);
  }),
);

guestsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = guestSchema.parse(req.body);
    const guest = await prisma.guest.create({ data });
    res.status(201).json(guest);
  }),
);

guestsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = guestSchema.partial().parse(req.body);
    const guest = await prisma.guest.update({ where: { id: req.params.id }, data });
    res.json(guest);
  }),
);

guestsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.guest.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
