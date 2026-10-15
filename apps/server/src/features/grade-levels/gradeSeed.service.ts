import { yearLevelService } from "./yearLevel.service";

/**
 * The old one-click "add Grades 1–12" setup utility. Since Phase 3b it adds the 2013-curriculum
 * template's year levels to the current school (levels it already has are left alone).
 */
export class GradeSeedService {
  async seedDefaultGrades() {
    const result = await yearLevelService.applyTemplate("LEGACY_GRADES_1_12", null);
    return {
      count: result.levels.length,
      created: result.created,
      grades: result.levels.map((g) => ({ id: g.id, name: g.name, sequence: g.sequence })),
    };
  }
}

export const gradeSeedService = new GradeSeedService();
