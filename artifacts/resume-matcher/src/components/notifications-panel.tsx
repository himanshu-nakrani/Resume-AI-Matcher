import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Bell,
  Check,
  CheckCheck,
  X,
  CalendarClock,
  CalendarCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  getListNotificationsQueryKey,
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const ICON_MAP = {
  deadline: CalendarClock,
  follow_up: CalendarCheck,
  info: Info,
};

const COLOR_MAP = {
  deadline: "text-orange-500",
  follow_up: "text-blue-500",
  info: "text-muted-foreground",
};

type NotificationsPanelProps = {
  triggerClassName?: string;
};

type NormalizedNotification = {
  id: number;
  type: keyof typeof ICON_MAP;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  analysisId: number | null;
};

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateTime(value: unknown): number {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatCreatedAt(value: unknown): string {
  const time = dateTime(value);
  if (!time) return "Date unavailable";
  return formatDistanceToNow(new Date(time), { addSuffix: true });
}

function normalizeNotification(value: unknown): NormalizedNotification | null {
  if (!value || typeof value !== "object") return null;
  const notification = value as Record<string, unknown>;
  const id = numberValue(notification.id);
  if (id == null) return null;

  const title =
    typeof notification.title === "string" && notification.title.trim()
      ? notification.title.trim()
      : "Notification";
  const body =
    typeof notification.body === "string" ? notification.body.trim() : "";
  const type =
    notification.type === "deadline" ||
    notification.type === "follow_up" ||
    notification.type === "info"
      ? notification.type
      : "info";

  return {
    id,
    type,
    title,
    body,
    read: notification.read === true,
    createdAt:
      typeof notification.createdAt === "string" ? notification.createdAt : "",
    analysisId: numberValue(notification.analysisId),
  };
}

export function NotificationsPanel({
  triggerClassName,
}: NotificationsPanelProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const notificationsQueryKey = getListNotificationsQueryKey();
  const {
    data: notifications = [],
    isLoading,
    error,
  } = useListNotifications({
    query: { queryKey: notificationsQueryKey, refetchInterval: 60_000 },
  });

  const visibleNotifications = useMemo(
    () =>
      (Array.isArray(notifications) ? notifications : [])
        .map(normalizeNotification)
        .filter((n): n is NormalizedNotification => n != null)
        .sort(
          (a, b) =>
            dateTime(b.createdAt) - dateTime(a.createdAt) || b.id - a.id,
        ),
    [notifications],
  );

  const markAll = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
        toast({ title: "Notifications marked read" });
      },
      onError: (err) => {
        toast({
          title: "Could not update notifications",
          description:
            err instanceof Error ? err.message : "Try again in a moment.",
          variant: "destructive",
        });
      },
    },
  });

  const markOne = useMarkNotificationRead({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
      onError: (err) => {
        toast({
          title: "Could not mark notification read",
          description:
            err instanceof Error ? err.message : "Try again in a moment.",
          variant: "destructive",
        });
      },
    },
  });

  const unread = visibleNotifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  const handleNotificationClick = (n: NormalizedNotification) => {
    if (!n.read) {
      markOne.mutate({ id: n.id });
    }
    if (n.analysisId) {
      setLocation("/analysis/" + n.analysisId);
      setOpen(false);
    }
  };

  const handleNotificationKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    notification: NormalizedNotification,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleNotificationClick(notification);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={`relative ${triggerClassName ?? "h-9 w-9"}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed left-3 right-3 top-14 z-50 overflow-hidden rounded-xl border bg-card shadow-xl md:bottom-14 md:right-auto md:top-auto md:w-80">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold">Notifications</span>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={markAll.isPending}
                    onClick={() => markAll.mutate()}
                  >
                    <CheckCheck className="w-3.5 h-3.5 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="max-h-[min(20rem,calc(100vh-10rem))] overflow-y-auto md:max-h-[min(20rem,calc(100vh-8rem))]">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-12 animate-pulse rounded-md bg-muted"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="px-4 py-10 text-center text-destructive">
                  <Bell className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-medium">
                    Could not load notifications
                  </p>
                  <p className="mt-1 text-[11px] text-destructive/80">
                    {error instanceof Error
                      ? error.message
                      : "Try again in a moment."}
                  </p>
                </div>
              ) : visibleNotifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No notifications yet</p>
                </div>
              ) : (
                visibleNotifications.map((n) => {
                  const IconComp = ICON_MAP[n.type] ?? Info;
                  const iconColor =
                    COLOR_MAP[n.type] ?? "text-muted-foreground";
                  return (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleNotificationClick(n)}
                      onKeyDown={(event) => handleNotificationKeyDown(event, n)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0 ${
                        !n.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <IconComp
                        className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`break-words text-xs font-medium leading-tight ${!n.read ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" />
                          )}
                        </div>
                        {n.body && (
                          <p className="mt-0.5 break-words text-xs leading-tight text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {formatCreatedAt(n.createdAt)}
                        </p>
                      </div>
                      {!n.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-5 h-5 shrink-0 mt-0.5 opacity-50 hover:opacity-100"
                          disabled={markOne.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            markOne.mutate({ id: n.id });
                          }}
                          aria-label="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {unread > 0 && (
              <div className="px-4 py-2 border-t">
                <Badge variant="secondary" className="text-xs">
                  {unread} unread
                </Badge>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
