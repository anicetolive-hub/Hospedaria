import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { getDeviceInfo, getDeviceStatus } from "../services/tuyaService";

export const roomsRouter = Router();

const commandSchema = z.object({
  code: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const roomSchema = z.object({
  number: z.string().min(1),
  name: z.string().optional(),
  floor: z.string().optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]).optional(),
  tuyaDeviceId: z.string().optional().or(z.literal("")),
  tuyaCheckinCommands: z.array(commandSchema).optional(),
  tuyaCheckoutCommands: z.array(commandSchema).optional(),
});

function serialize(data: Partial<z.infer<typeof roomSchema>>) {
  return {
    ...(data.number !== undefined && { number: data.number }),
    ...(data.name !== undefined && { name: data.name }),
    ...(data.floor !== undefined && { floor: data.floor }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.tuyaDeviceId !== undefined && { tuyaDeviceId: data.tuyaDeviceId || null }),
    ...(data.tuyaCheckinCommands !== undefined && { tuyaCheckinCommands: JSON.stringify(data.tuyaCheckinCommands) }),
    ...(data.tuyaCheckoutCommands !== undefined && {
      tuyaCheckoutCommands: JSON.stringify(data.tuyaCheckoutCommands),
    }),
  };
}

roomsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rooms = await prisma.room.findMany({ orderBy: { number: "asc" } });
    res.json(rooms);
  }),
);

roomsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ error: "Quarto não encontrado" });
    res.json(room);
  }),
);

roomsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = roomSchema.parse(req.body);
    const room = await prisma.room.create({ data: { ...serialize(data), number: data.number } });
    res.status(201).json(room);
  }),
);

roomsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = roomSchema.partial().parse(req.body);
    const room = await prisma.room.update({ where: { id: req.params.id }, data: serialize(data) });
    res.json(room);
  }),
);

roomsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.room.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

/** Testa o dispositivo Tuya vinculado ao quarto (nome, online, status atual). */
roomsRouter.get(
  "/:id/tuya-test",
  asyncHandler(async (req, res) => {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ error: "Quarto não encontrado" });
    if (!room.tuyaDeviceId) return res.status(400).json({ error: "Quarto sem dispositivo Tuya vinculado" });

    const [info, status] = await Promise.all([getDeviceInfo(room.tuyaDeviceId), getDeviceStatus(room.tuyaDeviceId)]);
    res.json({ info, status });
  }),
);
