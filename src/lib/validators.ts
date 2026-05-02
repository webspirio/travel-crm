import { z } from "zod"
import { isValidPhoneNumber } from "libphonenumber-js"

export const newClientSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().refine(isValidPhoneNumber, "errors.invalidPhone"),
  nationality: z.enum(["UA", "DE"]),
})

export type NewClientForm = z.infer<typeof newClientSchema>

export const clientStepSchema = z
  .object({
    clientId: z.string().nullable(),
    newClient: newClientSchema.optional(),
  })
  .refine(
    (v) => Boolean(v.clientId) || Boolean(v.newClient),
    "Select an existing client or create a new one",
  )

export const tripStepSchema = z.object({
  tripId: z.string().min(1, "Pick a trip"),
})

export const seatStepSchema = z.object({
  seatNumber: z.number().int().min(1, "Pick a seat"),
})

export const hotelStepSchema = z.object({
  hotelId: z.string().min(1, "Pick a hotel"),
  roomType: z.enum(["single", "double", "triple", "family"]),
})
