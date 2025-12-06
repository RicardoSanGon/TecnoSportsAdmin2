export class CreatePushSubscriptionDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: number;
}

// DTO for storing in DB (flattened structure)
export class StorePushSubscriptionDto {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId?: number;
}
