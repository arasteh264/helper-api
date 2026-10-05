export interface OtpSender {
  send(email: string, code: string, expiresInSeconds?: number): Promise<void>;
}
