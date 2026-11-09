/** Shapes the announcements API returns (features/announcements on the server). */

export interface AttachmentInfo {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AnnouncementBase {
  id: string;
  title: string;
  body: string;
  audience: "LEADERS" | "ALL_STAFF";
  requiresAck: boolean;
  office: { id: string; name: string; type: "HQ" | "PROVINCIAL" | "DISTRICT" };
  publishedAt: string;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  attachments: AttachmentInfo[];
}

export interface InboxItem extends AnnouncementBase {
  readAt: string | null;
  schoolAcknowledged: { at: string; by: string | null } | null;
  needsAcknowledgement: boolean;
  canAcknowledge: boolean;
}

export interface Inbox {
  announcements: InboxItem[];
  unread: number;
  toAcknowledge: number;
}

export interface OfficeListItem extends AnnouncementBase {
  sentByMyOffice: boolean;
  schools: number;
  opened: number;
  acknowledged: number;
}

export interface OfficeDetail extends AnnouncementBase {
  publishedBy: string | null;
  sentByMyOffice: boolean;
  canWithdraw: boolean;
  schools: number;
  opened: number;
  acknowledged: number;
  rows: {
    schoolId: string;
    name: string;
    emisNumber: string | null;
    district: string;
    readers: number;
    firstReadAt: string | null;
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
  }[];
}

export const AUDIENCE_LABEL = {
  LEADERS: "Head teachers and deputies",
  ALL_STAFF: "All staff",
} as const;
