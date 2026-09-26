export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}
