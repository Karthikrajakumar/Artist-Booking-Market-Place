export interface SmsAdapter {
  sendOtp(phone: string, code: string): Promise<boolean>;
}
