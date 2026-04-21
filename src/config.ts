import { z } from "zod";

const EnvSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  TRANSPORT: z.enum(["http", "stdio"]).default("http"),
  DOCUMENT_SERVER_BASE_URL: z.url("DOCUMENT_SERVER_BASE_URL must be a valid URL"),
  DOCUMENT_SERVER_JWT_SECRET: z.string().min(1, "DOCUMENT_SERVER_JWT_SECRET is required"),
  DOCUMENT_SERVER_JWT_ALGORITHM: z.enum(["HS256", "HS384", "HS512"]).default("HS256"),
  DOCUMENT_SERVER_JWT_EXPIRES_IN: z.coerce.number().int().positive().default(60),
});

export const CONFIG = EnvSchema.parse(process.env);
