import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { ValidationError } from "@/lib/http/errors";
import { firstIssueMessage } from "@/lib/http/zod-message";
import { paymentService } from "@/features/fees/payment.service";
import { recordPaymentSchema } from "@/features/fees/fees.validation";

/** GET /api/finance/payments?from=&to=&method=&studentId=&q=&voided=1 — payments, newest first. */
export const GET = withAuth(async (request: Request, user) => {
  try {
    const q = new URL(request.url).searchParams;
    return ApiResponse.success(
      await paymentService.list({ userId: user.userId, role: user.role }, {
        from: q.get("from"),
        to: q.get("to"),
        method: q.get("method"),
        studentId: q.get("studentId"),
        q: q.get("q"),
        includeVoided: q.get("voided") === "1",
      })
    );
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "GET /api/finance/payments" });
  }
});

/** POST /api/finance/payments — record a payment; returns the receipt. */
export const POST = withAuth(async (request: Request, user) => {
  try {
    const parsed = recordPaymentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError(firstIssueMessage(parsed.error, "Check the details"));
    return ApiResponse.created(await paymentService.record({ userId: user.userId, role: user.role }, parsed.data));
  } catch (error) {
    return handleApiError(error, { userId: user.userId, endpoint: "POST /api/finance/payments" });
  }
});
