import { SmsService } from './sms.service';

describe('SmsService', () => {
  const originalApiKey = process.env.SMS_IR_API_KEY;
  const originalHeaderApiKey = process.env['X-API-KEY'];
  const originalLineNumber = process.env.SMS_IR_LINE_NUMBER;
  const originalTemplateId = process.env.SMS_IR_OTP_TEMPLATE_ID;
  const originalParameterName = process.env.SMS_IR_OTP_PARAMETER_NAME;
  const originalFetch = global.fetch;
  let service: SmsService;

  beforeEach(() => {
    process.env.SMS_IR_API_KEY = 'test-api-key';
    process.env.SMS_IR_LINE_NUMBER = '30001234567890';
    process.env.SMS_IR_OTP_TEMPLATE_ID = '12345';
    process.env.SMS_IR_OTP_PARAMETER_NAME = 'Code';
    service = new SmsService();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.SMS_IR_API_KEY;
    } else {
      process.env.SMS_IR_API_KEY = originalApiKey;
    }
    if (originalHeaderApiKey === undefined) {
      delete process.env['X-API-KEY'];
    } else {
      process.env['X-API-KEY'] = originalHeaderApiKey;
    }
    if (originalLineNumber === undefined) {
      delete process.env.SMS_IR_LINE_NUMBER;
    } else {
      process.env.SMS_IR_LINE_NUMBER = originalLineNumber;
    }
    if (originalTemplateId === undefined) {
      delete process.env.SMS_IR_OTP_TEMPLATE_ID;
    } else {
      process.env.SMS_IR_OTP_TEMPLATE_ID = originalTemplateId;
    }
    if (originalParameterName === undefined) {
      delete process.env.SMS_IR_OTP_PARAMETER_NAME;
    } else {
      process.env.SMS_IR_OTP_PARAMETER_NAME = originalParameterName;
    }
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends messages through SMS.ir with the configured API key and sender line', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 1, message: 'موفق' }),
    });
    global.fetch = fetchMock;

    await service.sendNotification('09121234567', 'Test message');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.sms.ir/v1/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-KEY': 'test-api-key' }),
        body: JSON.stringify({
          lineNumber: 30001234567890,
          messageText: 'Test message',
          mobiles: ['09121234567'],
        }),
      }),
    );
  });

  it('sends OTPs through the SMS.ir verification template API', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 1 }),
    });
    global.fetch = fetchMock;

    await service.sendOtp('09121234567', '123456');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.sms.ir/v1/send/verify',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'text/plain',
          'x-api-key': 'test-api-key',
        }),
        body: JSON.stringify({
          mobile: '09121234567',
          templateId: 12345,
          parameters: [{ name: 'Code', value: '123456' }],
        }),
      }),
    );
  });

  it('uses the SMS.ir sandbox verify template when no template ID is configured', async () => {
    delete process.env.SMS_IR_OTP_TEMPLATE_ID;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 1 }),
    });
    global.fetch = fetchMock;

    await service.sendOtp('09121234567', '123456');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(
      expect.objectContaining({ templateId: 123456 }),
    );
  });

  it('uses the documented Code parameter for the SMS.ir sandbox template', async () => {
    process.env.SMS_IR_OTP_TEMPLATE_ID = '123456';
    process.env.SMS_IR_OTP_PARAMETER_NAME =
      'not-a-valid-template-parameter-name-value';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 1 }),
    });
    global.fetch = fetchMock;

    await service.sendOtp('09121234567', '123456');

    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body as string).parameters,
    ).toEqual([{ name: 'Code', value: '123456' }]);
  });

  it('accepts the API key configured with its SMS.ir header name', async () => {
    delete process.env.SMS_IR_API_KEY;
    process.env['X-API-KEY'] = 'header-named-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 1 }),
    });
    global.fetch = fetchMock;

    await service.sendOtp('09121234567', '123456');

    expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe(
      'header-named-key',
    );
  });

  it('rejects delivery when SMS.ir reports a failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 0 }),
    });

    await expect(
      service.sendNotification('09121234567', 'Test message'),
    ).rejects.toThrow('SMS.ir message delivery failed');
  });

  it('fails explicitly when SMS.ir settings are missing', async () => {
    delete process.env.SMS_IR_API_KEY;
    delete process.env['X-API-KEY'];

    await expect(
      service.sendNotification('09121234567', 'Test message'),
    ).rejects.toThrow(
      'SMS_IR_API_KEY (or X-API-KEY) and SMS_IR_LINE_NUMBER must be configured',
    );
  });
});
