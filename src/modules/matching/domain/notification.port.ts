// domain/notification.port.ts
export interface NotificationPort {
  notifyNewRequest(input: {
    phone: string;
    distanceKm: number | null;
  }): Promise<void>;
}

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');