import { useState } from "react";
import { useGenerateFollowUpEmail } from "@workspace/api-client-react";
import { useCopy } from "@/hooks/use-copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Mail, Copy, Check, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type EmailType = "after_apply" | "after_interview" | "thank_you";

export function FollowUpEmail({ analysisId }: { analysisId: number }) {
  const [emailType, setEmailType] = useState<EmailType>("after_apply");
  const { copy, isCopied } = useCopy();

  const generate = useGenerateFollowUpEmail();

  const handleGenerate = () => {
    generate.mutate({
      id: analysisId,
      data: { emailType },
    });
  };

  const email = generate.data;

  return (
    <Card className="border shadow-sm no-print">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-500" /> Follow-up Email Generator
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate a professional follow-up email for your application.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Select
              value={emailType}
              onValueChange={(v) => setEmailType(v as EmailType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select email type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="after_apply">After Apply</SelectItem>
                <SelectItem value="after_interview">After Interview</SelectItem>
                <SelectItem value="thank_you">Thank You</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="shrink-0"
          >
            {generate.isPending ? (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                Generating...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Generate Email
              </>
            )}
          </Button>
        </div>

        {generate.isPending && (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {email && !generate.isPending && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Subject Line
                </p>
                <div className="flex items-center justify-between group">
                  <p className="text-sm font-medium">{email.subject}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => copy(email.subject, "Subject copied")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email Body
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() =>
                      copy(`${email.subject}\n\n${email.body}`, "Email copied")
                    }
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy All
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-background rounded border p-3">
                  <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                    {email.body}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
