import { supabase } from "./supabase";

export interface Notification {
  id: string;
  created_at: string;
  recipient_id: string;
  recipient_role: "customer" | "owner";
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  order_id: string | null;
  store_id: string | null;
}

export const NotificationService = {
  /**
   * Fetch all notifications for a specific user role sorted by creation date descending
   */
  async fetchNotifications(
    recipientId: string,
    role: "customer" | "owner"
  ): Promise<Notification[]> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", recipientId)
      .eq("recipient_role", role)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notifications:", error);
      throw error;
    }

    return (data as Notification[]) || [];
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.error(`Error marking notification ${notificationId} as read:`, error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read for a recipient and role
   */
  async markAllAsRead(recipientId: string, role: "customer" | "owner"): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", recipientId)
      .eq("recipient_role", role)
      .eq("is_read", false);

    if (error) {
      console.error(`Error marking all notifications as read for recipient ${recipientId}:`, error);
      throw error;
    }
  },

  /**
   * Create a new notification record in the database
   */
  async createNotification(
    notification: Omit<Notification, "id" | "created_at" | "is_read">
  ): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .insert({
        recipient_id: notification.recipient_id,
        recipient_role: notification.recipient_role,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        order_id: notification.order_id,
        store_id: notification.store_id,
        is_read: false,
      });

    if (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  },

  /**
   * Subscribe to real-time notification insertions for a user role
   */
  subscribeToNotifications(
    recipientId: string,
    role: "customer" | "owner",
    onNotification: (notification: Notification) => void
  ) {
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channelName = `realtime-notifications-${role}-${recipientId}-${uniqueId}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${recipientId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          // Verify recipient role matches
          if (newNotif.recipient_role === role) {
            onNotification(newNotif);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

/**
 * Helper function to format timestamp into friendly relative time string
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  if (isNaN(date.getTime()) || diffMs < 0) {
    return "Just now";
  }

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "Just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
