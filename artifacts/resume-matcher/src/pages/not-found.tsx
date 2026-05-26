import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { FileQuestion, Home, ArrowLeft, History } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-purple-500/5 p-4">
      <div className="text-center space-y-6 max-w-md">
        <div
          className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center mx-auto animate-float"
        >
          <FileQuestion className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h1 className="text-4xl font-bold text-foreground">404</h1>
          <h2 className="text-xl font-semibold mt-1">Page not found</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="gradient" onClick={() => setLocation("/")}>
            <Home className="w-4 h-4 mr-2" />
            Go home
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go back
          </Button>
          <Button variant="ghost" onClick={() => setLocation("/history")}>
            <History className="w-4 h-4 mr-2" />
            History
          </Button>
        </div>
      </div>

    </div>
  );
}
