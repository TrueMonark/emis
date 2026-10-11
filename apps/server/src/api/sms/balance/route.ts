import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { SmsGatewayService } from "@/features/sms/smsGateway.service";
import { AfricasTalkingService } from "@/features/sms/africasTalking.service";
import { loadSmsConfig } from "@/lib/sms/sms-config";
import { logger } from "@/lib/logger/logger";

export async function GET(request: Request) {
  return withAuth(async (req, user) => {
    try {
      logger.logRequest("GET", "/api/sms/balance", user.userId);

      const provider = (new URL(req.url).searchParams.get("provider") ?? "AFRICAS_TALKING") as
        | "SMS_GATEWAY"
        | "AFRICAS_TALKING";

      const config = await loadSmsConfig();

      const balance =
        provider === "SMS_GATEWAY"
          ? await new SmsGatewayService(config.smsgateway).checkBalance()
          : await new AfricasTalkingService(config.africastalking).checkBalance();

      return ApiResponse.success(balance);
    } catch (error) {
      return handleApiError(error, { userId: user.userId, endpoint: "/api/sms/balance" });
    }
  })(request);
}
