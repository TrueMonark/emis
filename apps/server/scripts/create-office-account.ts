/**
 * Creates an education office account from the command line — used once, to make the first
 * Ministry HQ account (after that, HQ creates PEO accounts, PEOs create DEBS accounts, and so on,
 * from the office pages).
 *
 *   npm run office:create-account -- --email hq.admin@example.zm --name "Jane Phiri"
 *   npm run office:create-account -- --email peo@example.zm --name "John Banda" --office office-prov-lusaka
 *   npm run office:create-account -- --email hq.admin@example.zm --reset
 *
 * --phone 0977123456 also lets them sign in with that mobile number.
 * --reset issues a new one-time password for an existing office account. It's the last resort
 * for HQ heads (everyone else asks through "Forgot password?" on the sign-in page).
 *
 * Prints a one-time password once. The person must choose their own password at first sign-in
 * (the server enforces it), and the one-time password stops working after OTP_TTL_HOURS.
 * Uses the database in .env (owner connection, as migrations do).
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { issueOneTimePassword, oneTimePasswordTtlHours } from "../src/features/auth/one-time-password";
import { normalizeZambianPhone } from "@school/shared/auth/sign-in-id";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const prisma = new PrismaClient();

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  const officeId = arg("office") ?? "office-hq";
  const role = (arg("role") ?? "OFFICE_HEAD") as "OFFICE_HEAD" | "OFFICER";
  const title = arg("title") ?? null;
  const phoneArg = arg("phone");
  const phone = phoneArg ? normalizeZambianPhone(phoneArg) : null;
  if (phoneArg && !phone) throw new Error("--phone must be a Zambian mobile number, e.g. 0977123456");

  if (process.argv.includes("--reset")) {
    if (!email) throw new Error("Usage: npm run office:create-account -- --email someone@example.zm --reset");
    const user = await prisma.user.findUnique({
      where: { email },
      include: { officeMemberships: { where: { status: "ACTIVE" }, include: { office: true } } },
    });
    const membership = user?.officeMemberships[0];
    if (!user || !membership) throw new Error(`${email} has no active education office account.`);
    const otp = await issueOneTimePassword();
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: otp.passwordHash, hasDefaultPassword: true, temporaryPasswordExpiresAt: otp.expiresAt },
    });
    await prisma.auditLog.create({
      data: {
        action: "PASSWORD_RESET",
        targetType: "ACCOUNT",
        targetId: user.id,
        officeId: membership.officeId,
        summary: `Reset the password of ${user.displayName ?? email} (${membership.office.name}) from the command line`,
      },
    });
    console.log(`\nNew one-time password for ${email}: ${otp.password}`);
    console.log(`  It expires in ${oneTimePasswordTtlHours()} hours; they choose their own password at sign-in.\n`);
    return;
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    throw new Error('Usage: npm run office:create-account -- --email someone@example.zm --name "Full Name" [--phone 0977123456] [--office office-hq] [--role OFFICE_HEAD|OFFICER] [--title "Director"]  (or --email … --reset)');
  }
  if (role !== "OFFICE_HEAD" && role !== "OFFICER") throw new Error("--role must be OFFICE_HEAD or OFFICER");

  const office = await prisma.educationOffice.findUnique({ where: { id: officeId } });
  if (!office) throw new Error(`No office with id ${officeId}. HQ is office-hq; provinces are office-prov-<name>.`);

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error(`${email} already has an account.`);
  }
  if (phone && (await prisma.user.findUnique({ where: { phone } }))) {
    throw new Error(`${phoneArg} is already used to sign in to another account.`);
  }

  const otp = await issueOneTimePassword();
  await prisma.user.create({
    data: {
      email,
      phone,
      displayName: name,
      passwordHash: otp.passwordHash,
      hasDefaultPassword: true,
      temporaryPasswordExpiresAt: otp.expiresAt,
      officeMemberships: { create: { officeId, role, title } },
    },
  });
  await prisma.auditLog.create({
    data: {
      action: "ACCOUNT_CREATED",
      targetType: "ACCOUNT",
      officeId,
      summary: `Created account for ${name} (${email}) as ${role === "OFFICE_HEAD" ? "head" : "officer"} of ${office.name} (from the command line)`,
    },
  });

  console.log(`\nAccount created for ${name} at ${office.name}.`);
  console.log(`  Email:             ${email}`);
  console.log(`  One-time password: ${otp.password}`);
  console.log(`  It expires in ${oneTimePasswordTtlHours()} hours; they choose their own password at first sign-in.\n`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
