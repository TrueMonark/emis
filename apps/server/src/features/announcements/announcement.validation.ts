import { z } from "zod";

/** The text fields of a new announcement (sent as form fields with the files). */
export const postAnnouncementSchema = z.object({
  title: z.string().trim().min(3, "Give the announcement a title").max(150, "Keep the title under 150 characters"),
  body: z.string().trim().min(3, "Write the announcement").max(10_000, "Keep the announcement under 10,000 characters"),
  audience: z.enum(["LEADERS", "ALL_STAFF"], { message: "Choose who receives it" }),
  requiresAck: z.boolean(),
});

export const withdrawAnnouncementSchema = z.object({
  reason: z.string().trim().min(3, "Say why it is being withdrawn").max(500),
});

export type PostAnnouncementInput = z.infer<typeof postAnnouncementSchema>;

/** A file sent with an announcement, as received. */
export interface IncomingFile {
  name: string;
  bytes: Buffer;
}

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
/** The server takes at most 10 MB per request (API_BODY_LIMIT); keep a margin for the form. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 9 * 1024 * 1024;
