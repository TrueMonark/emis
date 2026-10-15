import { apiRequest, authFetch } from "@/lib/api-client";
import { downloadClassReportCards } from "@/lib/pdf-generator";

/**
 * Downloading a whole class's report cards for one term as a ZIP of PDFs. Shared by the head
 * teacher's Bulk Download dialog and the class teacher's Class Reports page.
 */

/** Every report card for the class and term (pages through the API's 100-per-page cap). */
export async function fetchClassTermReportCards(classId: string, termId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- report card shape as returned by the API
  const all: any[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiRequest<{ data: any[]; meta: { totalPages: number } }>(
      `/report-cards?classId=${classId}&termId=${termId}&page=${page}&pageSize=100`
    );
    all.push(...res.data);
    totalPages = res.meta?.totalPages ?? 1;
    page++;
  } while (page <= totalPages);
  return all;
}

/** The school's name and logo for the PDF header (best effort: PDFs work without them). */
export async function fetchSchoolBranding(): Promise<{ schoolName?: string; logoUrl?: string }> {
  try {
    const res = await authFetch("/api/admin/settings/school-info");
    if (!res.ok) return {};
    const info = await res.json();
    let schoolName: string | undefined;
    if (info.settings && typeof info.settings === "object" && !Array.isArray(info.settings)) {
      schoolName = info.settings.name;
    } else if (Array.isArray(info.settings)) {
      schoolName = info.settings.find((s: { key: string }) => s.key === "name")?.value;
    }
    return { schoolName, logoUrl: info.logoBase64 || undefined };
  } catch {
    return {};
  }
}

/** Builds and saves the ZIP. Returns how many report cards it contained (0 = nothing saved). */
export async function downloadClassTermReportCardsZip(options: {
  classId: string;
  termId: string;
  className: string;
  gradeName: string;
  onProgress?: (percent: number) => void;
}): Promise<number> {
  const cards = await fetchClassTermReportCards(options.classId, options.termId);
  if (cards.length === 0) return 0;
  const { schoolName, logoUrl } = await fetchSchoolBranding();
  await downloadClassReportCards(cards, options.className, options.gradeName, options.onProgress, schoolName, logoUrl);
  return cards.length;
}
