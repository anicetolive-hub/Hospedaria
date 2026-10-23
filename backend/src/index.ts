import cors from "cors";
import express from "express";
import { env } from "./lib/env";
import { errorHandler } from "./middleware/errorHandler";
import { guestsRouter } from "./routes/guests";
import { performanceRouter } from "./routes/performance";
import { reservationsRouter } from "./routes/reservations";
import { roomsRouter } from "./routes/rooms";
import { tuyaRouter } from "./routes/tuya";
import { startAlertScheduler } from "./services/performance/alertNotifier";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/guests", guestsRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/tuya", tuyaRouter);
app.use("/api/performance", performanceRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`API da Hospedaria rodando em http://localhost:${env.port}`);
  startAlertScheduler();
});
