import { z } from "zod";
 
const DEFAULT_WORD_AI_TOOLS = [
  "insertPage",
  "changeParagraphStyle",
  "changeTextStyle",
  "writeMacro",
];
const DEFAULT_CELL_AI_TOOLS = [
  "addAboveAverage",
  "addCellValueCondition",
  "addChart",
  "addColorScale",
  "addConditionalFormatting",
  "addDataBars",
  "addIconSet",
  "addTop10Condition",
  "addUniqueValues",
  "clearConditionalFormatting",
  "formatTable",
  "changeTextStyle",
  "writeMacro",
];
const DEFAULT_SLIDE_AI_TOOLS = [
  "addNewSlide",
  "addShapeToSlide",
  "addTableToSlide",
  "addTextToPlaceholder",
  "changeSlideBackground",
  "deleteSlide",
  "duplicateSlide",
  "writeMacro",
];
const DEFAULT_PDF_AI_TOOLS = Array();

function makeToolsSchema(defaultValue: string[] | "all") {
  return z
    .string()
    .optional()
    .transform((val): string[] | "all" => {
      if (!val) return defaultValue;
      if (val === "all") return "all";
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed as string[];
      } catch {}
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    });
}

function makeStringListSchema(defaultValue: string[] = []) {
  return z
    .string()
    .optional()
    .transform((val): string[] => {
      if (!val) return defaultValue;
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === "string");
        }
      } catch {}
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    });
}

function makeCorsOriginListSchema(defaultValue: string[] = []) {
  return makeStringListSchema(defaultValue).superRefine((origins, ctx) => {
    for (const origin of origins) {
      if (origin === "*") continue;

      try {
        new URL(origin);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: `CORS_ALLOWED_ORIGINS must contain valid origins or "*", got: ${origin}`,
        });
      }
    }
  });
}

const EnvSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  TRANSPORT: z.enum(["http", "stdio"]).default("http"),
  CORS_ALLOWED_ORIGINS: makeCorsOriginListSchema(),
  LOCAL_FILE_ALLOWED_ROOTS: makeStringListSchema(),
  DOCUMENT_SERVER_BASE_URL: z.url("DOCUMENT_SERVER_BASE_URL must be a valid URL"),
  DOCUMENT_SERVER_JWT_SECRET: z.string().min(1, "DOCUMENT_SERVER_JWT_SECRET is required"),
  DOCUMENT_SERVER_JWT_ALGORITHM: z.enum(["HS256", "HS384", "HS512"]).default("HS256"),
  DOCUMENT_SERVER_JWT_EXPIRES_IN: z.coerce.number().int().positive().default(60),
  DOCUMENT_SERVER_AI_WORD_TOOLS_ENABLED: makeToolsSchema(DEFAULT_WORD_AI_TOOLS),
  DOCUMENT_SERVER_AI_CELL_TOOLS_ENABLED: makeToolsSchema(DEFAULT_CELL_AI_TOOLS),
  DOCUMENT_SERVER_AI_SLIDE_TOOLS_ENABLED: makeToolsSchema(DEFAULT_SLIDE_AI_TOOLS),
  DOCUMENT_SERVER_AI_PDF_TOOLS_ENABLED: makeToolsSchema(DEFAULT_PDF_AI_TOOLS),
  DOCUMENT_SERVER_AI_WORD_TOOLS_DISABLED: makeToolsSchema([]),
  DOCUMENT_SERVER_AI_CELL_TOOLS_DISABLED: makeToolsSchema([]),
  DOCUMENT_SERVER_AI_SLIDE_TOOLS_DISABLED: makeToolsSchema([]),
  DOCUMENT_SERVER_AI_PDF_TOOLS_DISABLED: makeToolsSchema("all"),
});

export const CONFIG = EnvSchema.parse(process.env);
