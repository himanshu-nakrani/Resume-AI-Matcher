import { useState } from "react";
import { useLocation } from "wouter";
import { Bell, Check, CheckCheck, X, CalendarClock, CalendarCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { getListNotificationsQueryKey, useListNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

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

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: notifications = [] } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), refetchInterval: 60_000 },
  });

  const markAll = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listNotifications"] }),
    },
  });

  const markOne = useMarkNotificationRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listNotifications"] }),
    },
  });

  const unread = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (n: typeof notifications[0]) => {
    if (!n.read) {
      markOne.mutate({ id: n.id });
    }
    if (n.analysisId) {
      setLocation("/analysis/" + n.analysisId);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative w-8 h-8"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
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
          <div className="absolute right-0 top-10 z-50 w-80 bg-card border rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold">Notifications</span>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => markAll.mutate()}
                  >
                    <CheckCheck className="w-3.5 h-3.5 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const IconComp = ICON_MAP[n.type as keyof typeof ICON_MAP] ?? Info;
                  const iconColor = COLOR_MAP[n.type as keyof typeof COLOR_MAP] ?? "text-muted-foreground";
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0 ${
                        !n.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <IconComp className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-medium leading-tight ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-5 h-5 shrink-0 mt-0.5 opacity-50 hover:opacity-100"
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
                <Badge variant="secondary" className="text-xs">{unread} unread</Badge>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
