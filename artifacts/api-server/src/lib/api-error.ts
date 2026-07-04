import type { Request, Response } from "express";

type ErrorDetails = Record<string, unknown>;

function requestId(req: Request): string | undefined {
  return (req as Request & { id?: string }).id;
}

export function sendApiError(
  req: Request,
  res: Response,
  status: number,
  code: string,
  message: string,
  details: ErrorDetails = {},
): void {
  res.status(status).json({
    error: {
      code,
      message,
      requestId: requestId(req),
    },
    ...details,
  });
}
