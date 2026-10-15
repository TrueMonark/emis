/**
 * Reloads the national subject catalogue and pathways from packages/shared/src/curriculum
 * (catalogue.ts, pathways.ts) into the database: adds new entries and updates changed ones by
 * code. Nothing is deleted, so school subjects linked to an entry keep their link.
 *
 *   npm run db:sync-catalogue
 *
 * Uses the database in .env (the owner connection, as migrations do). National lists only —
 * no school data is touched.
 */
import { config } from "dotenv";
config();

import { PrismaClient, type Prisma, type YearStage } from "@prisma/client";
import { NATIONAL_SUBJECT_CATALOGUE } from "@school/shared/curriculum/catalogue";
import { NATIONAL_PATHWAYS } from "@school/shared/curriculum/pathways";

const prisma = new PrismaClient();

async function main() {
  for (const [i, s] of NATIONAL_SUBJECT_CATALOGUE.entries()) {
    const data = {
      name: s.name,
      groupName: s.groupName,
      groupNumber: s.groupNumber ?? null,
      stages: s.stages as YearStage[],
      periodsPerWeek: (s.periodsPerWeek ?? undefined) as Prisma.InputJsonValue | undefined,
      compulsoryOLevel: s.compulsoryOLevel ?? false,
      sortOrder: i + 1,
    };
    await prisma.catalogueSubject.upsert({
      where: { code: s.code },
      update: data,
      create: { id: `cat_${s.code.toLowerCase()}`, code: s.code, ...data },
    });
  }
  for (const [i, p] of NATIONAL_PATHWAYS.entries()) {
    const data = {
      name: p.name,
      stage: p.stage as YearStage,
      rules: p.rules as unknown as Prisma.InputJsonValue,
      sortOrder: i + 1,
    };
    await prisma.pathway.upsert({
      where: { code: p.code },
      update: data,
      create: { id: `pw_${p.code.toLowerCase()}`, code: p.code, ...data },
    });
  }
  console.log(
    `National lists up to date: ${NATIONAL_SUBJECT_CATALOGUE.length} subjects, ${NATIONAL_PATHWAYS.length} pathways.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
