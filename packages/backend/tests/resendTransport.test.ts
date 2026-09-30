import { ResendTransport } from '../src/services/ResendTransport';

describe('ResendTransport', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('posts the message to the Resend API and returns its id', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_123' }),
    });
    global.fetch = fetchMock as any;

    const result = await new ResendTransport('re_key').sendMail({
      from: 'Bomizzel <noreply@bomizzel.com>',
      to: 'someone@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
      replyTo: 'support@bomizzel.com',
      inReplyTo: '<abc@x>',
      references: ['<abc@x>', '<def@x>'],
      headers: { 'X-Notification-Type': 'email_verification', 'X-Ticket-ID': undefined },
    });

    expect(result.messageId).toBe('msg_123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: 'Bomizzel <noreply@bomizzel.com>',
      to: ['someone@example.com'],
      subject: 'Hello',
      reply_to: 'support@bomizzel.com',
      headers: {
        'X-Notification-Type': 'email_verification',
        'In-Reply-To': '<abc@x>',
        References: '<abc@x> <def@x>',
      },
    });
    expect(body.headers['X-Ticket-ID']).toBeUndefined();
  });

  it('throws with the API error message when Resend refuses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'The bomizzel.com domain is not verified' }),
    }) as any;

    await expect(
      new ResendTransport('re_key').sendMail({ to: 'a@example.com', subject: 's', text: 't' })
    ).rejects.toThrow('Resend 403: The bomizzel.com domain is not verified');
  });
});
