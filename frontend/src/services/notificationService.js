// Notification Service for Browser Push Notifications
// Uses the native Notification API - completely FREE

class NotificationService {
  constructor() {
    this.permission = Notification.permission;
    this.scheduledReminders = new Map();
  }

  // Request permission from user
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    }

    return false;
  }

  // Check if notifications are supported and permitted
  isSupported() {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  // Show immediate notification
  show(title, options = {}) {
    if (!this.isSupported()) {
      console.warn('Notifications not available');
      return null;
    }

    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      ...options
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) {
        options.onClick();
      }
    };

    return notification;
  }

  // Show medication reminder
  showMedicationReminder(medication) {
    return this.show(`Time to take ${medication.name}`, {
      body: `${medication.dosage} - ${medication.instructions || 'Take as directed'}`,
      tag: `medication-${medication.medication_id}`,
      renotify: true,
      actions: [
        { action: 'take', title: 'Mark as Taken' },
        { action: 'snooze', title: 'Remind in 10 min' }
      ]
    });
  }

  // Schedule a reminder for a specific time
  scheduleReminder(medication, scheduledTime) {
    const now = new Date();
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    
    const reminderTime = new Date();
    reminderTime.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, don't schedule
    if (reminderTime <= now) {
      return null;
    }

    const delay = reminderTime.getTime() - now.getTime();
    const key = `${medication.medication_id}-${scheduledTime}`;

    // Clear existing reminder if any
    if (this.scheduledReminders.has(key)) {
      clearTimeout(this.scheduledReminders.get(key));
    }

    const timeoutId = setTimeout(() => {
      this.showMedicationReminder(medication);
      this.scheduledReminders.delete(key);
    }, delay);

    this.scheduledReminders.set(key, timeoutId);
    
    return timeoutId;
  }

  // Schedule all reminders for today
  scheduleAllReminders(medications) {
    // Clear existing reminders
    this.clearAllReminders();

    medications.forEach(med => {
      if (med.times && Array.isArray(med.times)) {
        med.times.forEach(time => {
          this.scheduleReminder(med, time);
        });
      }
    });

    return this.scheduledReminders.size;
  }

  // Clear all scheduled reminders
  clearAllReminders() {
    this.scheduledReminders.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.scheduledReminders.clear();
  }

  // Get scheduled reminders count
  getScheduledCount() {
    return this.scheduledReminders.size;
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
