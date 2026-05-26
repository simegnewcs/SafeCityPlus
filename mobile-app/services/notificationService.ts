import { API_BASE_URL } from './incidentService';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'incident' | 'system' | 'emergency' | 'assignment';
  read: boolean;
  created_at: string;
  data?: any; // Additional data like incident_id, etc.
}

class NotificationService {
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private notifications: Notification[] = [];
  private unreadCount = 0;

  // Subscribe to notification updates
  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    listener(this.notifications);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.notifications));
  }

  // Fetch notifications from backend
  async fetchNotifications(userId?: number): Promise<Notification[]> {
    try {
      const url = userId 
        ? `${API_BASE_URL}/notifications/user/${userId}`
        : `${API_BASE_URL}/notifications`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        this.notifications = data.notifications || [];
        this.updateUnreadCount();
        this.notifyListeners();
        return this.notifications;
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
    return [];
  }

  // Get unread count
  getUnreadCount(): number {
    return this.unreadCount;
  }

  // Update unread count
  private updateUnreadCount() {
    this.unreadCount = this.notifications.filter(n => !n.read).length;
  }

  // Mark notification as read
  async markAsRead(notificationId: number): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.read = true;
          this.updateUnreadCount();
          this.notifyListeners();
        }
        return true;
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
    return false;
  }

  // Mark all notifications as read
  async markAllAsRead(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        this.notifications.forEach(n => n.read = true);
        this.updateUnreadCount();
        this.notifyListeners();
        return true;
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
    return false;
  }

  // Add a new notification (for real-time updates)
  addNotification(notification: Notification) {
    this.notifications.unshift(notification);
    this.updateUnreadCount();
    this.notifyListeners();
  }

  // Get notifications
  getNotifications(): Notification[] {
    return this.notifications;
  }
}

export const notificationService = new NotificationService();
