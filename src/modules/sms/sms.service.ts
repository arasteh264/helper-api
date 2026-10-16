import { Injectable } from '@nestjs/common';

type SmsIrResponse = {
  status?: number;
  message?: string;
  data?: unknown;
};

@Injectable()
export class SmsService {
  async sendOtp(phone: string, code: string): Promise<void> {
    const apiKey = this.getApiKey();
    const templateIdValue = process.env.SMS_IR_OTP_TEMPLATE_ID || '123456';

    if (!apiKey) {
      throw new Error(
        'Set SMS_IR_API_KEY (or X-API-KEY) in the API process environment',
      );
    }

    const templateId = Number(templateIdValue);
    if (!Number.isSafeInteger(templateId) || templateId <= 0) {
      throw new Error('SMS_IR_OTP_TEMPLATE_ID must be a positive integer');
    }

    const configuredParameterName = process.env.SMS_IR_OTP_PARAMETER_NAME;
    const parameterName =
      templateId === 123456 ? 'Code' : configuredParameterName;
    if (!parameterName || !/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(parameterName)) {
      throw new Error(
        'SMS_IR_OTP_PARAMETER_NAME must match a key configured in the SMS.ir template',
      );
    }

    const response = await fetch('https://api.sms.ir/v1/send/verify', {
      method: 'POST',
      headers: {
        Accept: 'text/plain',
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        mobile: phone,
        templateId,
        parameters: [
          {
            name: parameterName,
            value: code,
          },
        ],
      }),
    });

    const result = await this.readResponse(response);
    if (!response.ok || result.status !== 1) {
      throw new Error(
        `SMS.ir OTP delivery failed (HTTP ${response.status}, status ${result.status ?? 'unknown'}${result.message ? `: ${result.message}` : ''})`,
      );
    }
  }

  async sendNotification(phone: string, message: string): Promise<void> {
    const apiKey = this.getApiKey();
    const lineNumberValue = process.env.SMS_IR_LINE_NUMBER;

    if (!apiKey || !lineNumberValue) {
      throw new Error(
        'SMS_IR_API_KEY (or X-API-KEY) and SMS_IR_LINE_NUMBER must be configured',
      );
    }

    const lineNumber = Number(lineNumberValue);
    if (!Number.isSafeInteger(lineNumber) || lineNumber <= 0) {
      throw new Error('SMS_IR_LINE_NUMBER must be a positive integer');
    }

    const response = await fetch('https://api.sms.ir/v1/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        lineNumber,
        messageText: message,
        mobiles: [phone],
      }),
    });

    const result = await this.readResponse(response);
    if (!response.ok || result.status !== 1) {
      throw new Error(
        `SMS.ir message delivery failed (HTTP ${response.status}, status ${result.status ?? 'unknown'})`,
      );
    }
  }

  private async readResponse(response: Response): Promise<SmsIrResponse> {
    try {
      return (await response.json()) as SmsIrResponse;
    } catch {
      throw new Error(
        `SMS.ir returned an invalid response (HTTP ${response.status})`,
      );
    }
  }

  private getApiKey(): string | undefined {
    return process.env.SMS_IR_API_KEY || process.env['X-API-KEY'];
  }
}
