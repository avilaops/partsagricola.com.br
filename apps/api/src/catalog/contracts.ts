import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const referenceSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
});
export const modelSchema = referenceSchema.extend({
  yearStart: z.number().int().nullable(),
  yearEnd: z.number().int().nullable(),
});
export const categorySchema = referenceSchema.extend({
  parentId: uuidSchema.nullable(),
});
export const compatibilitySchema = z.object({
  id: uuidSchema,
  modelId: uuidSchema,
  machineType: z.string(),
  brand: z.string(),
  model: z.string(),
  yearStart: z.number().int().nullable(),
  yearEnd: z.number().int().nullable(),
});
export const partSchema = referenceSchema.extend({
  description: z.string().nullable(),
  brand: referenceSchema.nullable(),
  category: referenceSchema.nullable(),
  codes: z.array(
    z.object({
      code: z.string(),
      kind: z.enum(["ORIGINAL", "EQUIVALENT", "OEM", "GTIN", "SUPPLIER"]),
    }),
  ),
  compatibilities: z.array(compatibilitySchema),
});
export const priceSchema = z.object({
  onRequest: z.boolean(),
  original: z
    .object({
      amountMinor: z.number().int().nonnegative(),
      currency: z.string().length(3),
    })
    .nullable(),
  display: z
    .object({
      amountMinor: z.number().int().nonnegative(),
      currency: z.string().length(3),
    })
    .nullable(),
  approximate: z.boolean(),
  rateEffectiveAt: z.string().datetime().nullable(),
});
export const searchResultSchema = z.object({
  id: uuidSchema,
  listingType: z.enum(["PART", "MACHINE"]),
  title: z.string(),
  condition: z.enum(["NEW", "USED", "RECONDITIONED", "REMANUFACTURED"]),
  warrantyMonths: z.number().int().nullable(),
  stateCode: z.string().length(2),
  city: z.string(),
  publishedAt: z.string().datetime(),
  image: z.string().url().nullable(),
  company: z.object({
    id: uuidSchema,
    name: z.string(),
    verified: z.boolean(),
  }),
  part: z
    .object({ id: uuidSchema, name: z.string(), codes: z.array(z.string()) })
    .nullable(),
  machine: z
    .object({
      id: uuidSchema,
      type: z.string(),
      brand: z.string(),
      model: z.string(),
    })
    .nullable(),
  compatibilities: z.array(z.string()),
  rating: z.object({
    average: z.number().min(0).max(5),
    count: z.number().int().nonnegative(),
  }),
  price: priceSchema,
});
export const sortSchema = z.enum([
  "RELEVANCE",
  "PRICE_ASC",
  "NEWEST",
  "RATING",
]);
export const conditionSchema = z.enum([
  "NEW",
  "USED",
  "RECONDITIONED",
  "REMANUFACTURED",
]);
export const searchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    machineTypeId: uuidSchema.optional(),
    brandId: uuidSchema.optional(),
    modelId: uuidSchema.optional(),
    year: z.coerce.number().int().min(1900).max(2200).optional(),
    categoryId: uuidSchema.optional(),
    condition: conditionSchema.optional(),
    state: z
      .string()
      .trim()
      .length(2)
      .transform((value) => value.toUpperCase())
      .optional(),
    city: z.string().trim().min(1).max(120).optional(),
    priceMin: z.coerce.number().int().nonnegative().optional(),
    priceMax: z.coerce.number().int().nonnegative().optional(),
    hasWarranty: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    displayCurrency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .optional(),
    sort: sortSchema.optional(),
    cursor: z.string().min(1).max(1000).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(24),
    market: z.string().length(2).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.priceMin !== undefined &&
      value.priceMax !== undefined &&
      value.priceMin > value.priceMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "priceMin deve ser menor ou igual a priceMax",
        path: ["priceMin"],
      });
    }
  });

export type SearchSort = z.infer<typeof sortSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type Part = z.infer<typeof partSchema>;
export type Compatibility = z.infer<typeof compatibilitySchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type MachineModel = z.infer<typeof modelSchema>;
export type Category = z.infer<typeof categorySchema>;
