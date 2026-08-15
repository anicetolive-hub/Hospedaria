import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { checkTuyaConnection } from "../services/tuyaService";

export const tuyaRouter = Router();

tuyaRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const status = await checkTuyaConnection();
    res.json(status);
  }),
);
