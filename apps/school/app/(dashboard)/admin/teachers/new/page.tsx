"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherForm } from "@/components/teachers/teacher-form";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { useToast } from "@school/ui/hooks/use-toast";
import { useTeachers } from "@/hooks/useTeachers";
import {
  OneTimePasswordDialog,
  type IssuedPassword,
} from "@/components/accounts/one-time-password-dialog";

export default function NewTeacherPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createTeacher } = useTeachers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);

      // Format dates to ISO strings for API
      const formattedData = {
        ...data,
        dateOfBirth: data.dateOfBirth.toISOString(),
        hireDate: data.hireDate.toISOString(),
      };

      const created = (await createTeacher(formattedData)) as {
        temporaryPassword?: string;
        temporaryPasswordExpiresAt?: string;
      };

      toast({
        title: "Success",
        description: "Teacher created successfully",
      });

      if (created?.temporaryPassword && created.temporaryPasswordExpiresAt) {
        // Show the one-time password once; go back to the list when it's been noted.
        setIssued({
          name: `${data.firstName} ${data.lastName}`,
          email: data.email,
          temporaryPassword: created.temporaryPassword,
          temporaryPasswordExpiresAt: created.temporaryPasswordExpiresAt,
        });
      } else {
        router.push("/admin/teachers");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create teacher",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/admin/teachers");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col space-y-2">
          <h1 className="text-xl font-bold">Add New Teacher</h1>
          <p className="text-muted-foreground text-sm">
            Register a new teacher in the system
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Teacher Information</CardTitle>
        </CardHeader>
        <CardContent>
          <TeacherForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>

      <OneTimePasswordDialog
        issued={issued}
        reason="created"
        onClose={() => {
          setIssued(null);
          router.push("/admin/teachers");
        }}
      />
    </div>
  );
}
