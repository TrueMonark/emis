"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DepartmentForm } from "@/components/departments/department-form";
import { Card, CardContent, CardHeader, CardTitle } from "@school/ui/components/card";
import { useToast } from "@school/ui/hooks/use-toast";
import { useDepartments } from "@/hooks/useDepartments";
import { api } from "@/lib/api-client";

interface TeacherOption {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  user?: { email?: string };
}

export default function NewDepartmentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createDepartment } = useDepartments();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hodOptions, setHodOptions] = useState<Array<{ id: string; name: string; email: string }>>([]);

  // HOD is a position held by a teacher (Department.hodTeacherId is a
  // TeacherProfile id), so the options are all active teachers — the same
  // list the edit dialog uses.
  useEffect(() => {
    const fetchHodOptions = async () => {
      try {
        const { data } = await api.get<{ data: TeacherOption[] }>("/api/teachers?mode=all&status=ACTIVE");
        setHodOptions(
          (data ?? []).map((teacher) => ({
            id: teacher.id,
            name: `${teacher.firstName} ${teacher.lastName}`,
            email: teacher.user?.email || teacher.email || "",
          }))
        );
      } catch (error) {
        console.error("Failed to fetch HOD options:", error);
      }
    };

    fetchHodOptions();
  }, []);

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);

      await createDepartment(data);

      toast({
        title: "Success",
        description: "Department created successfully",
      });

      // Redirect to departments list
      router.push("/admin/departments");
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create department",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/admin/departments");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between mt-2">
        <div className="flex flex-col space-y-2">
          <h1 className="text-xl font-bold">Add New Department</h1>
          <p className="text-muted-foreground text-sm">
            Create a new department in the system
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Department Information</CardTitle>
        </CardHeader>
        <CardContent>
          <DepartmentForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            hodOptions={hodOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
