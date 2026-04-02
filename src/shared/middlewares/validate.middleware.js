import { ValidationError } from "../errors/AppError.js";

/**
 * Middleware générique Zod.
 * Fusionne body + params + query dans req.validated.
 * Usage: validate(MySchema.createSchema)
 */
export const validate = (schema) => (req, _res, next) => {
  const dataToValidate = {
    body: req.body,
    query: req.query,
    params: req.params,
  };

  const result = schema.safeParse(dataToValidate);

  if (!result.success) {
    const message = Object.entries(result.error.flatten().fieldErrors)
      .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
      .join(" | ");
    return next(new ValidationError(message));
  }

  req.validated = result.data;
  next();
};