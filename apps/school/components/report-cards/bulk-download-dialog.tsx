"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { formatCompactClassLabel } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@school/ui/components/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@school/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@school/ui/components/select";
import { Button } from "@school/ui/components/button";
import { Progress } from "@school/ui/components/progress";
import { Loader2, Download } from "lucide-react";
import { useClasses } from "@/hooks/useClasses";
import { useTerms } from "@/hooks/useTerms";
import { downloadClassTermReportCardsZip } from "@/lib/report-card-downloads";
import { useToast } from "@school/ui/hooks/use-toast";

const bulkDownloadSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  termId: z.string().min(1, "Term is required"),
});

type BulkDownloadFormValues = z.infer<typeof bulkDownloadSchema>;

interface BulkDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkDownloadDialog({
  open,
  onOpenChange,
}: BulkDownloadDialogProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const { classes, isLoading: classesLoading } = useClasses({ mode: "all" }, { page: 1, pageSize: 10 });
  const { terms, isLoading: termsLoading } = useTerms();

  const form = useForm<BulkDownloadFormValues>({
    resolver: zodResolver(bulkDownloadSchema),
    defaultValues: {
      classId: "",
      termId: "",
    },
  });

  const handleSubmit = async (data: BulkDownloadFormValues) => {
    try {
      setIsDownloading(true);
      setProgress(0);

      const selectedClass = classes.find((c) => c.id === data.classId);
      const className = selectedClass?.name || "Class";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- class list items include grade
      const gradeName = (selectedClass as any)?.grade?.name || "Grade";

      // Every report card for this class + term, with the school's name and logo, as one ZIP.
      const count = await downloadClassTermReportCardsZip({
        classId: data.classId,
        termId: data.termId,
        className,
        gradeName,
        onProgress: setProgress,
      });

      if (count === 0) {
        toast({
          title: "No Report Cards",
          description: "No report cards found for the selected class and term",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: `Downloaded ${count} report cards as ZIP`,
      });

      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Bulk download error:", error);
      toast({
        title: "Error",
        description: "Failed to download report cards",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Download Report Cards</DialogTitle>
          <DialogDescription>
            Download all report cards for a specific class and term as a ZIP file
          </DialogDescription>
        </DialogHeader>

        {isDownloading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Generating PDFs...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="classId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Class</FormLabel>
                  <Select
                    disabled={isDownloading || classesLoading}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {classes.map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.id}>
                          {formatCompactClassLabel((classItem as any).grade?.name, classItem.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the class to download report cards for
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="termId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Term</FormLabel>
                  <Select
                    disabled={isDownloading || termsLoading}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a term" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {terms.map((term) => (
                        <SelectItem key={term.id} value={term.id}>
                          {term.termType} - {(term as any).academicYear?.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the term to download report cards for
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isDownloading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isDownloading}>
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating ZIP...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download ZIP
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
