import { NotificationType } from '../Types';
import { v4 as uuidv4 } from 'uuid';

const notifications: Notification[] = new Array(0);
let currentModeMessage: Notification = null;
const NUMBER_TO_DISPLAY = 3; // Number of notifications to display at a time.
const TIMEOUT = 5000; // Number of notifications to display at a time.

const notificationIcon: Record<NotificationType, string> = {
  default: '',
  warning: '⚠️ ',
  error: '🔴 ',
  success: '✅ ',
};

/**
 * A class to manage cress notifications.
 */
export class Notification {
  message: string;
  displayed: boolean;
  id: string;
  isModeMessage: boolean;
  logInfo: string;
  timeoutID: number;
  type: NotificationType;
  /**
   * Create a new notification.
   * @param message - Notification content.
   */
  constructor(message: string, type: NotificationType, logInfo: string = null) {
    this.message = notificationIcon[type] + message;
    this.displayed = false;
    this.id = uuidv4();
    this.isModeMessage = message.search('Mode') !== -1;
    this.logInfo = logInfo;
    this.timeoutID = -1;
    this.type = type;
  }

  /** Set the ID from setTimeout. */
  setTimeoutId(id: number): void {
    this.timeoutID = Math.max(id, -1);
  }

  /** Display the Notification. */
  display(): void {
    this.displayed = true;
  }

  /**
   * @returns The UUID for this notification.
   */
  getId(): string {
    return this.id;
  }
}

/**
 * Clear the notification
 * @param currentId - The ID of the notification to be cleared.
 */
function clearNotification(currentId: string): void {
  if (document.getElementById(currentId)) {
    document.getElementById(currentId).remove();
  }
}

/**
 * Display a notification.
 * @param notification - Notification to display.
 */
function displayNotification(notification: Notification): void {
  // Not sure what it does, maybe related to rodan/cress
  if (notification.isModeMessage) {
    if (currentModeMessage === null) {
      currentModeMessage = notification;
    } else {
      window.clearTimeout(currentModeMessage.timeoutID);
      return;
    }
  }

  // Remove the top notification if exceeds maxmimum
  notifications.push(notification);
  if (notifications.length > NUMBER_TO_DISPLAY) {
    const toRemove = notifications.shift();
    clearNotification(toRemove.getId());
  }
  const notificationContent = document.getElementById('notification-content');
  const newNotification = document.createElement('div');
  newNotification.classList.add('cress-notification');
  newNotification.classList.add(`cress-notification-${notification.type}`);
  newNotification.id = notification.getId();
  newNotification.innerHTML = notification.message;
  notificationContent.append(newNotification);
  notificationContent.style.display = '';
  notification.display();
}

/**
 * Start displaying notifications. Called automatically.
 */
function startNotification(notification: Notification): void {
  displayNotification(notification);
  notification.setTimeoutId(
    window.setTimeout(clearNotification, TIMEOUT, notification.getId()),
  );
  document
    .getElementById(notification.getId())
    .addEventListener('click', () => {
      window.clearTimeout(notification.timeoutID);
      clearNotification(notification.getId());
    });
}

/**
 * Add a notification to the queue.
 * @param notification - Notification content.
 */
export function queueNotification(
  notificationContent: string,
  type: NotificationType = 'default',
  logInfo: string = null,
): void {
  const notification = new Notification(notificationContent, type, logInfo);

  startNotification(notification);
}

export default { queueNotification };
