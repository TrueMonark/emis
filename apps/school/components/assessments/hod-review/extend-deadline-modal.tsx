"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Clock, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@school/ui/components/dialog";
import { Button } from "@school/ui/components/button";
import { Label } from "@school/ui/components/label";
import { Calendar as CalendarComponent } from "@school/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@school/ui/components/popover";
import { TeacherAssessmentEntry } from "@school/shared/types/hod-assessment";
import { useToast } from "@school/ui/hooks/use-toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { authFetch } from "@/lib/api-client";

interface ExtendDeadlineModalProps {
  assessment: TeacherAssessmentEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExtendDeadlineModal({
  assessment,
  isOpen,
  onClose,
  onSuccess,
}: ExtendDeadlineModalProps) {
  const [newDeadline, setNewDeadline] = useState<Date | undefined>(
    assessment?.deadline
      ? new Date(new Date(assessment.deadline).getTime() + 2 * 24 * 60 * 60 * 1000)
      : undefined
  );
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!newDeadline || !assessment) return;

    setIsSaving(true);
    try {
      const response = await authFetch("/api/hod/assessment-entries/deadline", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          termId: assessment.termId,
          examType: assessment.assessmentType,
          newDeadline: newDeadline.toISOString(),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to extend deadline");
      }

      toast({
        title: "Deadline Extended",
        description: `New deadline set to ${format(newDeadline, "PPP")} for ${assessment.assessmentType} assessments in this term.`,
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to extend deadline. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!assessment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Extend Deadline
          </DialogTitle>
          <DialogDescription>
            Extends the entry window for all {assessment.assessmentType} assessments in this term.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Current Deadline</Label>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(assessment.deadline), "PPP")}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>New Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !newDeadline && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {newDeadline
                    ? format(newDeadline, "PPP")
                    : "Select new deadline"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={newDeadline}
                  onSelect={setNewDeadline}
                  disabled={(date) => date <= new Date(assessment.deadline)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !newDeadline}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Extend Deadline
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
