import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DOCUMENT_SERVER_BASE_URL: z.url("DOCUMENT_SERVER_BASE_URL must be a valid URL"),
});

export const CONFIG = EnvSchema.parse(process.env);
