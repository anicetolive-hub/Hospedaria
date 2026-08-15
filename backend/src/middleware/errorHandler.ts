import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

interface HttpError extends Error {
  status?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Dados inválidos", details: err.flatten() });
  }

  const httpError = err as HttpError;
  const status = httpError.status ?? 500;
  const message = httpError.message ?? "Erro interno";

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
}
