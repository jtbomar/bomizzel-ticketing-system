import { EmailTemplate } from '../src/models/EmailTemplate';

// Rendering is where user-supplied values become markup, so it is where they
// have to be escaped. Stubbing the lookup keeps that assertion independent of
// the database.
const stubTemplate = (fields: { subject: string; html_body: string; text_body: string }) => {
  jest.spyOn(EmailTemplate, 'findById').mockResolvedValue({
    id: 'tpl-1',
    name: 'test',
    is_active: true,
    ...fields,
  } as any);
};

describe('EmailTemplate.renderTemplate', () => {
  afterEach(() => jest.restoreAllMocks());

  it('substitutes variables into every part of the template', async () => {
    stubTemplate({
      subject: 'Ticket {{ticketNumber}}',
      html_body: '<p>Hello {{customerName}}</p>',
      text_body: 'Hello {{customerName}}',
    });

    const rendered = await EmailTemplate.renderTemplate('tpl-1', {
      ticketNumber: '1234',
      customerName: 'Dana',
    });

    expect(rendered).toEqual({
      subject: 'Ticket 1234',
      htmlBody: '<p>Hello Dana</p>',
      textBody: 'Hello Dana',
    });
  });

  it('escapes values interpolated into the HTML body', async () => {
    stubTemplate({
      subject: '{{subject}}',
      html_body: '<p>{{subject}}</p>',
      text_body: '{{subject}}',
    });

    const rendered = await EmailTemplate.renderTemplate('tpl-1', {
      subject: '<script>alert("x")</script>',
    });

    expect(rendered?.htmlBody).toBe('<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>');

    // Subject and text body are plain text - escaping them would just show
    // people &amp; in their inbox.
    expect(rendered?.subject).toBe('<script>alert("x")</script>');
    expect(rendered?.textBody).toBe('<script>alert("x")</script>');
  });

  it('treats replacement values literally', async () => {
    // $& and friends are replacement patterns to String.replace. A ticket
    // subject containing one must not be re-expanded.
    stubTemplate({ subject: '[{{title}}]', html_body: '<p>x</p>', text_body: 'x' });

    const rendered = await EmailTemplate.renderTemplate('tpl-1', { title: 'cost $& tax' });

    expect(rendered?.subject).toBe('[cost $& tax]');
  });

  it('handles variable names containing regex punctuation', async () => {
    stubTemplate({ subject: '{{ticket.id}}', html_body: '<p>x</p>', text_body: 'x' });

    const rendered = await EmailTemplate.renderTemplate('tpl-1', { 'ticket.id': '42' });

    expect(rendered?.subject).toBe('42');
  });

  it('leaves a placeholder in place when no value is supplied for it', async () => {
    // Current behaviour, recorded rather than endorsed: only supplied variables
    // are substituted, so an unsupplied one reaches the recipient as {{name}}.
    stubTemplate({ subject: 'Hi {{name}}', html_body: '<p>x</p>', text_body: 'x' });

    const rendered = await EmailTemplate.renderTemplate('tpl-1', {});

    expect(rendered?.subject).toBe('Hi {{name}}');
  });
});
