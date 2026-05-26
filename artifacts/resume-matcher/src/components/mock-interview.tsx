import { useState, useRef, useEffect } from "react";
import { useConductMockInterview } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, User, Send, RotateCcw, MessageSquareMore, CheckCircle2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  analysisId: number;
  jobTitle: string;
  companyName: string | null;
}

export function MockInterview({ analysisId, jobTitle, companyName }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [turnCount, setTurnCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const MAX_TURNS = 5;

  const conductInterview = useConductMockInterview();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, conductInterview.isPending]);

  const startInterview = () => {
    setMessages([]);
    setUserInput("");
    setTurnCount(0);
    setIsComplete(false);
    setOpen(true);
    conductInterview.mutate(
      { id: analysisId, data: { messages: [] } },
      {
        onSuccess: (data) => {
          setMessages([{ role: "assistant", content: data.question }]);
          if (data.isComplete) setIsComplete(true);
        },
      }
    );
  };

  const sendAnswer = () => {
    if (!userInput.trim() || conductInterview.isPending) return;
    const answer = userInput.trim();
    setUserInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: answer }];
    setMessages(newMessages);

    conductInterview.mutate(
      {
        id: analysisId,
        data: {
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        },
      },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: "assistant", content: data.question }]);
          const newTurn = turnCount + 1;
          setTurnCount(newTurn);
          if (data.isComplete || newTurn >= MAX_TURNS) setIsComplete(true);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendAnswer();
    }
  };

  const questionsAnswered = messages.filter((m) => m.role === "user").length;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareMore className="w-4 h-4 text-muted-foreground" />
          AI Mock Interview
          {messages.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {isComplete ? "Complete" : questionsAnswered + " / " + MAX_TURNS + " answered"}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2 no-print">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={startInterview} title="Restart interview">
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restart
            </Button>
          )}
          {messages.length === 0 && (
            <Button size="sm" onClick={startInterview} disabled={conductInterview.isPending}>
              {conductInterview.isPending ? "Starting..." : "Start Interview"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {messages.length === 0 && !conductInterview.isPending && (
          <p className="text-sm text-muted-foreground py-4">
            Practice a full mock interview for{" "}
            <strong>{jobTitle}</strong>
            {companyName ? " at " + companyName : ""}. The AI will ask {MAX_TURNS} targeted questions and provide real-time feedback on your answers.
          </p>
        )}

        {(messages.length > 0 || conductInterview.isPending) && (
          <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1 mb-4">
            {messages.map((msg, i) => (
              <div key={i} className={"flex gap-2 " + (msg.role === "user" ? "flex-row-reverse" : "")}>
                <div className={"w-7 h-7 rounded-full shrink-0 flex items-center justify-center " + (msg.role === "assistant" ? "bg-foreground text-background" : "bg-muted text-foreground border border-border")}>
                  {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className={"max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed " + (msg.role === "assistant" ? "bg-muted/60 rounded-tl-sm" : "bg-secondary border border-border rounded-tr-sm text-right")}>
                  {msg.content}
                </div>
              </div>
            ))}

            {conductInterview.isPending && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-foreground text-background">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-3 space-y-1.5">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {isComplete && messages.length > 0 && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 mb-4 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">Interview complete!</p>
              <p className="text-xs text-green-700/70 dark:text-green-400/70 mt-0.5">
                Great practice session. Click "Restart" to try again with fresh questions.
              </p>
            </div>
          </div>
        )}

        {messages.length > 0 && !isComplete && (
          <div className="space-y-2">
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer… (Ctrl+Enter to send)"
              className="min-h-[90px] resize-none text-sm"
              disabled={conductInterview.isPending}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={sendAnswer}
                disabled={!userInput.trim() || conductInterview.isPending}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {conductInterview.isPending ? "Sending..." : "Send Answer"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
