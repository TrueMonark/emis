import { withAuth } from "@/lib/http/with-auth";
import { ApiResponse } from "@/lib/http/api-response";
import { handleApiError } from "@/lib/http/error-handler";
import { notificationService } from "@/features/notifications/notification.service";
import { NotificationStatus, Role } from "@school/shared/types/prisma-enums";
import { AuthContext } from "@/lib/auth/authorization";

/**
 * PATCH /api/notifications/[id]
 * Mark notification as read/unread/archived
 */
export const PATCH = withAuth(
  async (request: Request, user, { params }) => {
    try {
      const { id } = await params;
      const context: AuthContext = { userId: user.userId, role: user.role as Role };

      const body = await request.json();
      const { status } = body;

      if (!status || !["UNREAD", "READ", "ARCHIVED"].includes(status)) {
        return ApiResponse.badRequest("Invalid status value");
      }

      const notification = await notificationService.updateNotificationStatus(
        id,
        status as NotificationStatus,
        context
      );

      return ApiResponse.success(notification);
    } catch (error) {
      return handleApiError(error, {
        userId: user.userId,
        endpoint: `PATCH /api/notifications/${(await params).id}`,
      });
    }
  }
);

/**
 * DELETE /api/notifications/[id]
 * Delete a notification
 */
export const DELETE = withAuth(
  async (request: Request, user, { params }) => {
    try {
      const { id } = await params;
      const context: AuthContext = { userId: user.userId, role: user.role as Role };

      await notificationService.deleteNotification(id, context);

      return ApiResponse.success({ message: "Notification deleted successfully" });
    } catch (error) {
      return handleApiError(error, {
        userId: user.userId,
        endpoint: `DELETE /api/notifications/${(await params).id}`,
      });
    }
  }
);
