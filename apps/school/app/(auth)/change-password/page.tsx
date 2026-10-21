"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@school/ui/components/button";
import { ChangePasswordCard } from "@/components/profile/change-password-card";
import { api, getAuthToken } from "@/lib/api-client";
import { homeRouteFor, type SignedInPerson } from "@/lib/auth/home-route";
import { Role } from "@school/shared/types/prisma-enums";
import { MonarkDevsCredit } from "@/components/layout/monark-devs-credit";

type Me = SignedInPerson & { role: Role; hasDefaultPassword: boolean };

/**
 * Where everyone on a one-time password lands after signing in (and whenever the server
 * answers PASSWORD_CHANGE_REQUIRED). Nothing else works until the password is changed; the
 * server enforces that, this page just makes it the obvious next step.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      router.replace("/login");
      return;
    }
    api
      .get<{ data: Me }>("/auth/me")
      .then(({ data }) => {
        if (!data.hasDefaultPassword) {
          router.replace(homeRouteFor(data));
          return;
        }
        setMe(data);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const handleChanged = () => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        localStorage.setItem("user", JSON.stringify({ ...JSON.parse(stored), hasDefaultPassword: false }));
      }
    } catch {
      // Stored user is only a convenience; the server is the source of truth.
    }
    router.replace(me ? homeRouteFor({ ...me, hasDefaultPassword: false }) : "/login");
  };

  const signOut = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    router.replace("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        {me ? (
          <ChangePasswordCard firstTime onChanged={handleChanged} />
        ) : (
          <div className="text-center text-sm text-muted-foreground">Loading…</div>
        )}
        <div className="text-center">
          <Button variant="link" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
        <MonarkDevsCredit />
      </div>
    </div>
  );
}
