import { config } from "dotenv";
config({ path: new URL("../.env", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });

import { PrismaClient } from "@prisma/client";
import {
  Role,
  Permission,
  Gender,
  QualificationLevel,
  StaffStatus,
} from "@school/shared/types/prisma-enums";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import { createTenantClient, runWithTenant } from "../src/lib/db/tenant";
import { randomBytes } from "node:crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set in .env");

// Demo data is for development machines only. Refuse to seed a database that
// isn't on this computer unless explicitly allowed — seeding a live database
// would create demo accounts there.
const dbHost = new URL(connectionString).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(dbHost) && process.env.SEED_ALLOW_REMOTE !== "true") {
  throw new Error(
    `Refusing to seed demo data into a database on "${dbHost}". ` +
      "Seeding is for local development only. Set SEED_ALLOW_REMOTE=true if you really mean it."
  );
}

// No fixed, publicly known demo passwords. Use SEED_DEMO_PASSWORD (e.g. in
// .env, for repeatable local testing) or get a fresh random one per run.
const demoPassword = process.env.SEED_DEMO_PASSWORD || randomBytes(9).toString("base64url");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
// `systemPrisma` sees every school (schools, memberships); `prisma` works inside the demo
// school, exactly like the app (row-level security, see src/lib/db/tenant.ts).
const systemPrisma = new PrismaClient({ adapter });
const prisma = createTenantClient(systemPrisma);

/**
 * The school the demo data goes in: the school the demo admin already belongs to (e.g. a
 * database that was in use before multi-school), otherwise a "Demo School".
 */
async function demoSchoolId(): Promise<string> {
  const existing = await systemPrisma.schoolMembership.findFirst({
    where: { user: { email: "admin@school.gov.zm" }, status: "ACTIVE" },
    select: { schoolId: true },
  });
  if (existing) return existing.schoolId;
  const school = await systemPrisma.school.upsert({
    where: { id: "school-demo" },
    update: {},
    create: { id: "school-demo", name: "Demo School", districtOfficeId: "office-district-unassigned" },
  });
  return school.id;
}

/** Make the user an ACTIVE member of the school with this role (and mirror it on User.role). */
async function ensureMembership(userId: string, schoolId: string, role: Role) {
  await systemPrisma.schoolMembership.upsert({
    where: { userId_schoolId: { userId, schoolId } },
    update: { role, status: "ACTIVE", endDate: null },
    create: { userId, schoolId, role, status: "ACTIVE" },
  });
  await systemPrisma.user.update({ where: { id: userId }, data: { role } });
}

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log("🌱 Seeding database...");
  const schoolId = await demoSchoolId();
  await runWithTenant({ schoolId, userId: null }, () => seedSchool(schoolId));
}

async function seedSchool(schoolId: string) {

  // ===============================
  // 1. Department
  // ===============================
  const mathDepartment = await prisma.department.upsert({
    where: { schoolId_code: { schoolId, code: "MATH" } },
    update: {},
    create: {
      name: "Mathematics Department",
      code: "MATH",
      description: "Handles Mathematics and related subjects",
      status: "ACTIVE",
    },
  });

  // ===============================
  // 2. Passwords
  // ===============================
  // One shared demo password (see top of file); all demo accounts must change
  // it at first login.
  const adminPassword = await hash(demoPassword);
  const mathHodPassword = adminPassword;
  const teacherPassword = adminPassword;

  // ===============================
  // 3. Users
  // ===============================
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@school.gov.zm" },
    // Re-running the seed resets the demo accounts to the password printed below,
    // so the printed password always works (local databases only, see the guard above).
    update: { passwordHash: adminPassword, hasDefaultPassword: true, isActive: true },
    create: {
      email: "admin@school.gov.zm",
      passwordHash: adminPassword,
      role: Role.HEAD_TEACHER, // the school's head (ADMIN is retired as a school role)
      isActive: true,
      hasDefaultPassword: true,
    },
  });

  // Math HOD - Role is TEACHER (HOD is a position, not a role)
  const mathHodUser = await prisma.user.upsert({
    where: { email: "hod.math@school.gov.zm" },
    // Re-running the seed resets the demo accounts to the password printed below,
    // so the printed password always works (local databases only, see the guard above).
    update: { passwordHash: adminPassword, hasDefaultPassword: true, isActive: true },
    create: {
      email: "hod.math@school.gov.zm",
      passwordHash: mathHodPassword,
      role: Role.TEACHER, // HOD is a position, not a role
      isActive: true,
      hasDefaultPassword: true,
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher1@school.gov.zm" },
    // Re-running the seed resets the demo accounts to the password printed below,
    // so the printed password always works (local databases only, see the guard above).
    update: { passwordHash: adminPassword, hasDefaultPassword: true, isActive: true },
    create: {
      email: "teacher1@school.gov.zm",
      passwordHash: teacherPassword,
      role: Role.TEACHER,
      isActive: true,
      hasDefaultPassword: true,
    },
  });

  // Their roles at the demo school (a person's role is per school).
  await ensureMembership(adminUser.id, schoolId, Role.HEAD_TEACHER);
  await ensureMembership(mathHodUser.id, schoolId, Role.TEACHER);
  await ensureMembership(teacherUser.id, schoolId, Role.TEACHER);

  // ===============================
  // 4. Teacher Profiles
  // ===============================
  const adminProfile = await prisma.teacherProfile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      staffNumber: "ADM001",
      firstName: "System",
      lastName: "Administrator",
      dateOfBirth: new Date("1980-01-01"),
      gender: Gender.MALE,
      phone: "+260970000001",
      qualification: QualificationLevel.DEGREE,
      yearsExperience: 15,
      status: StaffStatus.ACTIVE,
      hireDate: new Date(),
    },
  });

  const mathHodProfile = await prisma.teacherProfile.upsert({
    where: { userId: mathHodUser.id },
    update: {},
    create: {
      userId: mathHodUser.id,
      staffNumber: "MATH001",
      firstName: "Mary",
      lastName: "Phiri",
      dateOfBirth: new Date("1985-05-12"),
      gender: Gender.FEMALE,
      phone: "+260970000002",
      qualification: QualificationLevel.MASTERS,
      yearsExperience: 12,
      status: StaffStatus.ACTIVE,
      hireDate: new Date(),
    },
  });

  const teacher1Profile = await prisma.teacherProfile.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      staffNumber: "TCH001",
      firstName: "John",
      lastName: "Banda",
      dateOfBirth: new Date("1992-08-20"),
      gender: Gender.MALE,
      phone: "+260970000003",
      qualification: QualificationLevel.DIPLOMA,
      yearsExperience: 4,
      status: StaffStatus.ACTIVE,
      hireDate: new Date(),
    },
  });

  // ===============================
  // 5. Assign HOD to Department
  // ===============================
  // HOD is a POSITION in the department model, not a role
  await prisma.department.update({
    where: { schoolId_code: { schoolId, code: "MATH" } },
    data: {
      hodTeacher: {
        connect: { id: mathHodProfile.id },
      },
    },
  });

  console.log("✅ Assigned Mary Phiri as HOD of Mathematics Department");

  // ===============================
  // 6. Role Permissions
  // ===============================

  // ADMIN → ALL permissions
  const allPermissions = Object.values(Permission);

  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        role_permission: {
          role: Role.ADMIN,
          permission,
        },
      },
      update: {},
      create: {
        role: Role.ADMIN,
        permission,
      },
    });
  }

  // TEACHER → Basic permissions
  const teacherPermissions: Permission[] = [
    Permission.READ_STUDENT,
    Permission.READ_CLASS,
    Permission.READ_ASSESSMENT,
    Permission.ENTER_RESULTS,
    Permission.MARK_ATTENDANCE,
    Permission.VIEW_ATTENDANCE,
  ];

  for (const permission of teacherPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        role_permission: {
          role: Role.TEACHER,
          permission,
        },
      },
      update: {},
      create: {
        role: Role.TEACHER,
        permission,
      },
    });
  }

  // ===============================
  // 7. Grant HOD-specific permissions via UserPermission
  // ===============================
  // HOD is a position, not a role
  // Grant additional permissions to the Math HOD via UserPermission table
  const hodExtraPermissions: Permission[] = [
    Permission.UPDATE_TEACHER,
    Permission.CREATE_ASSESSMENT,
    Permission.UPDATE_ASSESSMENT,
    Permission.VIEW_REPORTS,
  ];

  for (const permission of hodExtraPermissions) {
    await prisma.userPermission.upsert({
      where: {
        schoolId_userId_permission: {
          schoolId,
          userId: mathHodUser.id,
          permission,
        },
      },
      update: {},
      create: {
        userId: mathHodUser.id,
        permission,
        reason: "HOD position for Mathematics Department",
      },
    });
  }

  console.log("✅ Granted additional permissions to Math HOD via UserPermission");

  // ===============================
  // 8. Subject Teacher Assignments for Grade 8 Blue
  // ===============================
  console.log("\n📚 Assigning subject teachers for Grade 8 Blue...");

  // Find Grade 8
  const grade8 = await prisma.grade.findFirst({
    where: { level: "GRADE_8" },
  });

  if (!grade8) {
    console.log("⚠️  Grade 8 not found, skipping subject teacher assignments");
  } else {
    // Find Grade 8 Blue class
    const grade8Blue = await prisma.class.findFirst({
      where: {
        gradeId: grade8.id,
        name: "Blue",
      },
    });

    if (!grade8Blue) {
      console.log("⚠️  Grade 8 Blue class not found, skipping subject teacher assignments");
    } else {
      // Find active academic year
      const activeAcademicYear = await prisma.academicYear.findFirst({
        where: { isActive: true },
      });

      if (!activeAcademicYear) {
        console.log("⚠️  No active academic year found, skipping subject teacher assignments");
      } else {
        console.log(`   Class: ${grade8Blue.name} (ID: ${grade8Blue.id})`);
        console.log(`   Academic Year: ${activeAcademicYear.year}`);

        // Get ALL ClassSubjects for Grade 8 Blue (this is the curriculum)
        const classSubjects = await prisma.classSubject.findMany({
          where: {
            classId: grade8Blue.id,
          },
          include: {
            subject: true,
          },
        });

        console.log(`   Found ${classSubjects.length} subjects in curriculum`);

        // Find teachers
        const jayDaka = await prisma.teacherProfile.findFirst({
          where: { staffNumber: "STAFF2026357" },
        });
        const mumaHanzoma = await prisma.teacherProfile.findFirst({
          where: { staffNumber: "STAFF2026304" },
        });
        const danielMccain = await prisma.teacherProfile.findFirst({
          where: { staffNumber: "STAFF2026803" },
        });
        const jamesMukosa = await prisma.teacherProfile.findFirst({
          where: { staffNumber: "STAFF2026148" },
        });

        // Assign teachers to each ClassSubject
        for (const cs of classSubjects) {
          let teacher = null;
          let teacherName = "";

          // Match subject to appropriate teacher
          if (cs.subject.code === "COMP" && jayDaka) {
            teacher = jayDaka;
            teacherName = "Jay Daka";
          } else if (cs.subject.code === "ENG" && mumaHanzoma) {
            teacher = mumaHanzoma;
            teacherName = "Muma Hanzoma";
          } else if (cs.subject.code === "LIT" && danielMccain) {
            teacher = danielMccain;
            teacherName = "Daniel Mccain";
          } else if (cs.subject.code === "MATH" && jamesMukosa) {
            teacher = jamesMukosa;
            teacherName = "James Mukosa";
          }

          if (teacher) {
            // Delete any existing assignment without classSubjectId link
            await prisma.subjectTeacherAssignment.deleteMany({
              where: {
                classId: grade8Blue.id,
                subjectId: cs.subjectId,
                academicYearId: activeAcademicYear.id,
                classSubjectId: null, // Only delete unlinked assignments
              },
            });

            // Create assignment linked to ClassSubject
            await prisma.subjectTeacherAssignment.upsert({
              where: {
                teacherId_subjectId_classId_academicYearId: {
                  teacherId: teacher.id,
                  subjectId: cs.subjectId,
                  classId: grade8Blue.id,
                  academicYearId: activeAcademicYear.id,
                },
              },
              update: {
                classSubjectId: cs.id, // Link to ClassSubject
              },
              create: {
                teacherId: teacher.id,
                subjectId: cs.subjectId,
                classId: grade8Blue.id,
                academicYearId: activeAcademicYear.id,
                classSubjectId: cs.id, // Link to ClassSubject
              },
            });

            console.log(`   ✅ Assigned ${cs.subject.name} to ${teacherName}`);
          }
        }

        console.log("\n✅ Subject teacher assignments completed for Grade 8 Blue");
      }
    }
  }

  console.log("\n✅ Seeding completed successfully");
  console.log("\n🔑 Demo accounts: admin@school.gov.zm, hod.math@school.gov.zm, teacher1@school.gov.zm");
  console.log(
    process.env.SEED_DEMO_PASSWORD
      ? "   Password: the value of SEED_DEMO_PASSWORD"
      : `   Password (shown once; re-running the seed sets a new one): ${demoPassword}`
  );
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await systemPrisma.$disconnect();
  });
