export type OfficeType = "HQ" | "PROVINCIAL" | "DISTRICT";
export type OfficeRole = "OFFICE_HEAD" | "OFFICER";

export const OFFICE_TYPE_LABEL: Record<OfficeType, string> = {
  HQ: "Ministry HQ",
  PROVINCIAL: "Provincial Education Office",
  DISTRICT: "District Education Board",
};

export const OFFICE_SHORT: Record<OfficeType, string> = {
  HQ: "HQ",
  PROVINCIAL: "PEO",
  DISTRICT: "DEBS",
};

/** "Head" in plain words for each kind of office. */
export const HEAD_LABEL: Record<OfficeType, string> = {
  HQ: "Head (HQ)",
  PROVINCIAL: "Provincial Education Officer",
  DISTRICT: "District Education Board Secretary",
};

export function roleLabel(role: OfficeRole, type: OfficeType): string {
  return role === "OFFICE_HEAD" ? HEAD_LABEL[type] : "Officer";
}

export const CATEGORY_LABEL: Record<string, string> = {
  PUBLIC: "Public (government)",
  AIDED: "Grant-aided",
  COMMUNITY: "Community",
  PRIVATE: "Private",
};
