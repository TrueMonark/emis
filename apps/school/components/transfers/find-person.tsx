"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@school/ui/components/button";
import { Input } from "@school/ui/components/input";
import { api } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/utils";

export interface FoundPerson {
  userId: string;
  name: string;
  staffNumber: string | null;
  hasStaffProfile: boolean;
  currentSchool: { name: string; isThisSchool: boolean } | null;
  pendingTransferTo: string | null;
}

/**
 * Find one existing person by their exact email address or mobile number (there's no browsing of
 * other schools' staff). `path` is `/staff/lookup` (schools) or `/office/people` (offices).
 */
export function FindPerson({
  path,
  onFound,
}: {
  path: "/staff/lookup" | "/office/people";
  onFound: (person: FoundPerson | null) => void;
}) {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const search = async () => {
    setSearching(true);
    setMessage(null);
    try {
      const res = await api.get<{ data: FoundPerson | null }>(`${path}?q=${encodeURIComponent(q.trim())}`);
      if (!res.data) setMessage("No account with that email or mobile number. Check it, or add them as a new person.");
      onFound(res.data ?? null);
    } catch (err) {
      setMessage(getErrorMessage(err, "Couldn't search"));
      onFound(null);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Their email or mobile number"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) {
              e.preventDefault();
              search();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={search} disabled={searching || !q.trim()}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">Find</span>
        </Button>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

/** One line about the person found, and why they can't be added (if they can't). */
export function FoundPersonSummary({ person }: { person: FoundPerson }) {
  const problem = !person.hasStaffProfile
    ? "This is an education office account, not school staff."
    : person.currentSchool?.isThisSchool
      ? "They already work at this school."
      : person.pendingTransferTo
        ? `They already have a transfer waiting (to ${person.pendingTransferTo}).`
        : null;
  return (
    <div className="rounded-md border p-3 text-sm space-y-1">
      <p className="font-medium">
        {person.name}
        {person.staffNumber && <span className="ml-2 text-xs text-muted-foreground">{person.staffNumber}</span>}
      </p>
      <p className="text-muted-foreground">
        {person.currentSchool
          ? `Works at ${person.currentSchool.name}. Their transfer must be confirmed by that school or its district office.`
          : "Not working at any school at the moment: they join straight away."}
      </p>
      {problem && <p className="text-destructive">{problem}</p>}
    </div>
  );
}

export function canAddPerson(person: FoundPerson | null): boolean {
  return !!person && person.hasStaffProfile && !person.currentSchool?.isThisSchool && !person.pendingTransferTo;
}
