import type { Analysis } from "@workspace/api-client-react";
import {
  useGenerateLinkedinPost,
  getGetAnalysisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/hooks/use-copy";
import { Linkedin, Copy, Check } from "lucide-react";

interface TabProps {
  analysis: Analysis;
  id: number;
}

export function LinkedInTab({ analysis, id }: TabProps) {
  const { copy, isCopied } = useCopy();
  const queryClient = useQueryClient();

  const generateLinkedinPost = useGenerateLinkedinPost({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) }),
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[15px] flex items-center gap-2">
            <Linkedin className="w-3.5 h-3.5 text-accent" /> LinkedIn post
          </CardTitle>
          <div className="flex gap-2 no-print">
            {analysis.linkedinPost && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(analysis.linkedinPost!, "LinkedIn post copied")}
                data-testid="button-copy-linkedin"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                Copy
              </Button>
            )}
            <Button
              size="sm"
              variant={analysis.linkedinPost ? "secondary" : "default"}
              onClick={() => generateLinkedinPost.mutate({ id })}
              disabled={generateLinkedinPost.isPending}
              data-testid="button-generate-linkedin"
            >
              {generateLinkedinPost.isPending ? "Generating…" : analysis.linkedinPost ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {generateLinkedinPost.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : analysis.linkedinPost ? (
          <Textarea
            value={analysis.linkedinPost}
            readOnly
            className="min-h-[180px] text-[13px] resize-none"
            data-testid="textarea-linkedin"
          />
        ) : (
          <p className="text-[13px] text-muted-foreground py-4">
            Click "Generate" to create a LinkedIn announcement for this role.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
