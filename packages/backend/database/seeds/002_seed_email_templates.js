/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('email_templates').del();

  // Insert default email templates
  await knex('email_templates').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'ticket_created',
      subject: 'New Ticket Created: {{ticket.title}}',
      html_body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>New Ticket Created</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #007bff; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; }
        .ticket-info { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { background-color: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .btn { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>New Ticket Created</h2>
        </div>
        
        <div class="content">
            <p>Hello {{customer.firstName}},</p>
            
            <p>A new support ticket has been created for your company <strong>{{company.name}}</strong>.</p>
            
            <div class="ticket-info">
                <h3>Ticket Details</h3>
                <p><strong>Ticket ID:</strong> {{ticket.id}}</p>
                <p><strong>Title:</strong> {{ticket.title}}</p>
                <p><strong>Status:</strong> {{ticket.status}}</p>
                <p><strong>Priority:</strong> {{ticket.priority}}</p>
                <p><strong>Created:</strong> {{ticket.createdAt}}</p>
            </div>
            
            <p>Our support team will review your ticket and respond as soon as possible.</p>
            
            <p><a href="{{system.baseUrl}}/tickets/{{ticket.id}}" class="btn">View Ticket</a></p>
        </div>
        
        <div class="footer">
            <p>This is an automated message from Bomizzel Support System</p>
        </div>
    </div>
</body>
</html>
      `,
      text_body: `
New Ticket Created

Hello {{customer.firstName}},

A new support ticket has been created for your company {{company.name}}.

Ticket Details:
- Ticket ID: {{ticket.id}}
- Title: {{ticket.title}}
- Status: {{ticket.status}}
- Priority: {{ticket.priority}}
- Created: {{ticket.createdAt}}

Our support team will review your ticket and respond as soon as possible.

View your ticket at: {{system.baseUrl}}/tickets/{{ticket.id}}

This is an automated message from Bomizzel Support System
      `,
      variables: JSON.stringify([
        'ticket.id',
        'ticket.title',
        'ticket.status',
        'ticket.priority',
        'ticket.createdAt',
        'customer.firstName',
        'company.name',
        'system.baseUrl',
      ]),
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'ticket_assigned',
      subject: 'Ticket Assigned: {{ticket.title}}',
      html_body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Ticket Assigned</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; }
        .ticket-info { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { background-color: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .btn { display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Ticket Assigned</h2>
        </div>
        
        <div class="content">
            <p>Hello {{customer.firstName}},</p>
            
            <p>Your support ticket has been assigned to <strong>{{assignee.fullName}}</strong> from our support team.</p>
            
            <div class="ticket-info">
                <h3>Ticket Details</h3>
                <p><strong>Ticket ID:</strong> {{ticket.id}}</p>
                <p><strong>Title:</strong> {{ticket.title}}</p>
                <p><strong>Status:</strong> {{ticket.status}}</p>
                <p><strong>Assigned to:</strong> {{assignee.fullName}}</p>
                <p><strong>Updated:</strong> {{ticket.updatedAt}}</p>
            </div>
            
            <p>Your assigned support representative will be in touch with you soon.</p>
            
            <p><a href="{{system.baseUrl}}/tickets/{{ticket.id}}" class="btn">View Ticket</a></p>
        </div>
        
        <div class="footer">
            <p>This is an automated message from Bomizzel Support System</p>
        </div>
    </div>
</body>
</html>
      `,
      text_body: `
Ticket Assigned

Hello {{customer.firstName}},

Your support ticket has been assigned to {{assignee.fullName}} from our support team.

Ticket Details:
- Ticket ID: {{ticket.id}}
- Title: {{ticket.title}}
- Status: {{ticket.status}}
- Assigned to: {{assignee.fullName}}
- Updated: {{ticket.updatedAt}}

Your assigned support representative will be in touch with you soon.

View your ticket at: {{system.baseUrl}}/tickets/{{ticket.id}}

This is an automated message from Bomizzel Support System
      `,
      variables: JSON.stringify([
        'ticket.id',
        'ticket.title',
        'ticket.status',
        'ticket.updatedAt',
        'customer.firstName',
        'assignee.fullName',
        'system.baseUrl',
      ]),
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'ticket_resolved',
      subject: 'Ticket Resolved: {{ticket.title}}',
      html_body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Ticket Resolved</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #17a2b8; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f8f9fa; padding: 20px; }
        .ticket-info { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { background-color: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .btn { display: inline-block; padding: 10px 20px; background-color: #17a2b8; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Ticket Resolved</h2>
        </div>
        
        <div class="content">
            <p>Hello {{customer.firstName}},</p>
            
            <p>Great news! Your support ticket has been resolved by our team.</p>
            
            <div class="ticket-info">
                <h3>Ticket Details</h3>
                <p><strong>Ticket ID:</strong> {{ticket.id}}</p>
                <p><strong>Title:</strong> {{ticket.title}}</p>
                <p><strong>Status:</strong> {{ticket.status}}</p>
                <p><strong>Resolved:</strong> {{ticket.updatedAt}}</p>
            </div>
            
            <p>If you have any questions about the resolution or need further assistance, please don't hesitate to contact us.</p>
            
            <p><a href="{{system.baseUrl}}/tickets/{{ticket.id}}" class="btn">View Ticket</a></p>
        </div>
        
        <div class="footer">
            <p>This is an automated message from Bomizzel Support System</p>
        </div>
    </div>
</body>
</html>
      `,
      text_body: `
Ticket Resolved

Hello {{customer.firstName}},

Great news! Your support ticket has been resolved by our team.

Ticket Details:
- Ticket ID: {{ticket.id}}
- Title: {{ticket.title}}
- Status: {{ticket.status}}
- Resolved: {{ticket.updatedAt}}

If you have any questions about the resolution or need further assistance, please don't hesitate to contact us.

View your ticket at: {{system.baseUrl}}/tickets/{{ticket.id}}

This is an automated message from Bomizzel Support System
      `,
      variables: JSON.stringify([
        'ticket.id',
        'ticket.title',
        'ticket.status',
        'ticket.updatedAt',
        'customer.firstName',
        'system.baseUrl',
      ]),
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'customer_reply',
      subject: 'Re: {{ticket.title}}',
      html_body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Customer Reply</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #6c757d; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
        .content { background-color: white; padding: 20px; border: 1px solid #dee2e6; }
        .footer { background-color: #f8f9fa; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; font-size: 12px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <p><strong>Ticket ID:</strong> {{ticket.id}} | <strong>Company:</strong> {{company.name}}</p>
        </div>
        
        <div class="content">
            {{emailContent}}
        </div>
        
        <div class="footer">
            <p>This email was sent from the Bomizzel Support System</p>
            <p>Please do not reply directly to this email. Use the support portal to respond.</p>
        </div>
    </div>
</body>
</html>
      `,
      text_body: `
Ticket ID: {{ticket.id}} | Company: {{company.name}}

{{emailContent}}

---
This email was sent from the Bomizzel Support System
Please do not reply directly to this email. Use the support portal to respond.
      `,
      variables: JSON.stringify(['ticket.id', 'ticket.title', 'company.name', 'emailContent']),
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'trial_welcome',
      subject: 'Welcome to Your {{planName}} Trial!',
      html_body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to Your Trial</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
        .content { background-color: #f8f9fa; padding: 20px; }
        .trial-info { background-color: white; padding: 20px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745; }
        .footer { background-color: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .highlight { background-color: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎉 Welcome to Your {{planName}} Trial!</h2>
        </div>
        
        <div class="content">
            <p>Congratulations! Your {{planName}} trial has been activated and you now have access to all premium features.</p>
            
            <div class="trial-info">
                <h3>Your Trial Details</h3>
                <p><strong>Plan:</strong> {{planName}}</p>
                <p><strong>Trial Period:</strong> {{daysRemaining}} days</p>
                <p><strong>Trial Ends:</strong> {{trialEnd}}</p>
            </div>
            
            <div class="highlight">
                <h4>What's Next?</h4>
                <ul>
                    <li>Explore all the premium features available in your plan</li>
                    <li>Create and manage unlimited tickets</li>
                    <li>Experience our advanced reporting and analytics</li>
                    <li>Get priority customer support</li>
                </ul>
            </div>
            
            <p>We'll send you reminders as your trial period progresses, so you won't miss the opportunity to continue with a paid subscription.</p>
            
            <p style="text-align: center;">
                <a href="{{system.baseUrl}}/dashboard" class="btn">Get Started</a>
            </p>
        </div>
        
        <div class="footer">
            <p>Questions? Contact our support team anytime!</p>
        </div>
    </div>
</body>
</html>
      `,
      text_body: `
Welcome to Your {{planName}} Trial!

Congratulations! Your {{planName}} trial has been activated and you now have access to all premium features.

Your Trial Details:
- Plan: {{planName}}
- Trial Period: {{daysRemaining}} days
- Trial Ends: {{trialEnd}}

What's Next?
- Explore all the premium features available in your plan
- Create and manage unlimited tickets
- Experience our advanced reporting and analytics
- Get priority customer support

We'll send you reminders as your trial period progresses, so you won't miss the opportunity to continue with a paid subscription.

Get started: {{system.baseUrl}}/dashboard

Questions? Contact our support team anytime!
      `,
      variables: JSON.stringify(['planName', 'daysRemaining', 'trialEnd', 'system.baseUrl']),
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'trial_reminder',
      subject: 'Your {{planName}} Trial Expires in {{daysRemaining}} Days',
      html_body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Trial Reminder</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ffc107; color: #212529; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
        .content { background-color: #f8f9fa; padding: 20px; }
        .reminder-info { background-color: white; padding: 20px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107; }
        .footer { background-color: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .btn-primary { background-color: #28a745; }
        .urgent { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>⏰ Trial Reminder</h2>
        </div>
        
        <div class="content">
            <p>Your {{planName}} trial is ending soon!</p>
            
            <div class="reminder-info">
                <h3>Trial Status</h3>
                <p><strong>Days Remaining:</strong> <span class="urgent">{{daysRemaining}} days</span></p>
                <p><strong>Trial Ends:</strong> {{trialEnd}}</p>
                <p><strong>Current Plan:</strong> {{planName}}</p>
            </div>
            
            <p>Don't lose access to your premium features! Upgrade now to continue enjoying:</p>
            <ul>
                <li>Unlimited ticket creation and management</li>
                <li>Advanced reporting and analytics</li>
                <li>Priority customer support</li>
                <li>Custom integrations and workflows</li>
            </ul>
            
            <p style="text-align: center;">
                <a href="{{upgradeUrl}}" class="btn btn-primary">Upgrade Now</a>
                <a href="{{system.baseUrl}}/dashboard" class="btn">View Dashboard</a>
            </p>
            
            <p><small>If you don't upgrade before your trial ends, your account will be downgraded to our free tier with limited features.</small></p>
        </div>
        
        <div class="footer">
            <p>Need help choosing a plan? Contact our sales team!</p>
        </div>
    </div>
</body>
</html>
      `,
      text_body: `
Trial Reminder

Your {{planName}} trial is ending soon!

Trial Status:
- Days Remaining: {{daysRemaining}} days
- Trial Ends: {{trialEnd}}
- Current Plan: {{planName}}

Don't lose access to your premium features! Upgrade now to continue enjoying:
- Unlimited ticket creation and management
- Advanced reporting and analytics
- Priority customer support
- Custom integrations and workflows

Upgrade now: {{upgradeUrl}}
View Dashboard: {{system.baseUrl}}/dashboard

If you don't upgrade before your trial ends, your account will be downgraded to our free tier with limited features.

Need help choosing a plan? Contact our sales team!
      `,
      variables: JSON.stringify([
        'planName',
        'daysRemaining',
        'trialEnd',
        'upgradeUrl',
        'system.baseUrl',
      ]),
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'trial_converted',
      subject: 'Welcome to {{planName}} - Your Subscription is Active!',
      html_body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Subscription Activated</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
        .content { background-color: #f8f9fa; padding: 20px; }
        .success-info { background-color: white; padding: 20px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745; }
        .footer { background-color: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎉 Welcome to {{planName}}!</h2>
        </div>
        
        <div class="content">
            <p>Congratulations! Your trial has been successfully converted to a paid {{planName}} subscription.</p>
            
            <div class="success-info">
                <h3>Your Subscription is Now Active</h3>
                <p>✅ Full access to all {{planName}} features</p>
                <p>✅ Monthly billing cycle activated</p>
                <p>✅ Priority customer support</p>
                <p>✅ No interruption to your service</p>
            </div>
            
            <p>You can manage your subscription, view billing history, and update payment methods from your dashboard.</p>
            
            <p style="text-align: center;">
                <a href="{{dashboardUrl}}" class="btn">Go to Dashboard</a>
            </p>
            
            <p>Thank you for choosing our platform! We're excited to support your business growth.</p>
        </div>
        
        <div class="footer">
            <p>Questions about your subscription? We're here to help!</p>
        </div>
    </div>
</body>
</html>
      `,
      text_body: `
Welcome to {{planName}}!

Congratulations! Your trial has been successfully converted to a paid {{planName}} subscription.

Your Subscription is Now Active:
✅ Full access to all {{planName}} features
✅ Monthly billing cycle activated
✅ Priority customer support
✅ No interruption to your service

You can manage your subscription, view billing history, and update payment methods from your dashboard.

Go to Dashboard: {{dashboardUrl}}

Thank you for choosing our platform! We're excited to support your business growth.

Questions about your subscription? We're here to help!
      `,
      variables: JSON.stringify(['planName', 'dashboardUrl']),
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'trial_cancelled',
      subject: 'Your Trial Has Been Cancelled',
      html_body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Trial Cancelled</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #6c757d; color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
        .content { background-color: #f8f9fa; padding: 20px; }
        .info-box { background-color: white; padding: 20px; border-radius: 5px; margin: 15px 0; }
        .footer { background-color: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Trial Cancelled</h2>
        </div>
        
        <div class="content">
            <p>We're sorry to see you go! Your trial subscription has been cancelled as requested.</p>
            
            <div class="info-box">
                <h3>What This Means</h3>
                <p>• Your trial access has been terminated</p>
                <p>• No charges have been made to your account</p>
                <p>• Your data remains safe and accessible</p>
                <p>• You can start a new trial anytime</p>
            </div>
            
            <p><strong>Cancellation Reason:</strong> {{reason}}</p>
            
            <p>We'd love to have you back! If you change your mind, you can explore our plans and start a new trial at any time.</p>
            
            <p style="text-align: center;">
                <a href="{{pricingUrl}}" class="btn">View Plans</a>
            </p>
            
            <p>If you have any feedback about your trial experience, we'd love to hear from you.</p>
        </div>
        
        <div class="footer">
            <p>Thank you for trying our platform!</p>
        </div>
    </div>
</body>
</html>
      `,
      text_body: `
Trial Cancelled

We're sorry to see you go! Your trial subscription has been cancelled as requested.

What This Means:
• Your trial access has been terminated
• No charges have been made to your account
• Your data remains safe and accessible
• You can start a new trial anytime

Cancellation Reason: {{reason}}

We'd love to have you back! If you change your mind, you can explore our plans and start a new trial at any time.

View Plans: {{pricingUrl}}

If you have any feedback about your trial experience, we'd love to hear from you.

Thank you for trying our platform!
      `,
      variables: JSON.stringify(['reason', 'pricingUrl']),
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'trial_extended',
      subject: 'Great News! Your Trial Has Been Extended',
      html_body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Trial Extended</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #17a2b8; color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
        .content { background-color: #f8f9fa; padding: 20px; }
        .extension-info { background-color: white; padding: 20px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #17a2b8; }
        .footer { background-color: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎉 Your Trial Has Been Extended!</h2>
        </div>
        
        <div class="content">
            <p>Great news! We've extended your trial period to give you more time to explore all our premium features.</p>
            
            <div class="extension-info">
                <h3>Extension Details</h3>
                <p><strong>Additional Days:</strong> {{additionalDays}} days</p>
                <p><strong>New Trial End Date:</strong> {{newTrialEnd}}</p>
                <p><strong>Total Extended Time:</strong> More time to explore!</p>
            </div>
            
            <p>Use this extra time to:</p>
            <ul>
                <li>Explore advanced features you might have missed</li>
                <li>Set up custom workflows for your team</li>
                <li>Test integrations with your existing tools</li>
                <li>Experience our full customer support</li>
            </ul>
            
            <p style="text-align: center;">
                <a href="{{dashboardUrl}}" class="btn">Continue Exploring</a>
            </p>
            
            <p>We're committed to helping you get the most out of our platform!</p>
        </div>
        
        <div class="footer">
            <p>Make the most of your extended trial!</p>
        </div>
    </div>
</body>
</html>
      `,
      text_body: `
Your Trial Has Been Extended!

Great news! We've extended your trial period to give you more time to explore all our premium features.

Extension Details:
- Additional Days: {{additionalDays}} days
- New Trial End Date: {{newTrialEnd}}
- Total Extended Time: More time to explore!

Use this extra time to:
- Explore advanced features you might have missed
- Set up custom workflows for your team
- Test integrations with your existing tools
- Experience our full customer support

Continue Exploring: {{dashboardUrl}}

We're committed to helping you get the most out of our platform!

Make the most of your extended trial!
      `,
      variables: JSON.stringify(['additionalDays', 'newTrialEnd', 'dashboardUrl']),
      is_active: true,
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name: 'trial_expired',
      subject: "Your Trial Has Ended - What's Next?",
      html_body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Trial Ended</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #6c757d; color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
        .content { background-color: #f8f9fa; padding: 20px; }
        .status-info { background-color: white; padding: 20px; border-radius: 5px; margin: 15px 0; }
        .footer { background-color: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .btn-primary { background-color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Your Trial Has Ended</h2>
        </div>
        
        <div class="content">
            <p>Your trial period has come to an end. Thank you for exploring our platform!</p>
            
            <div class="status-info">
                <h3>What Happens Now?</h3>
                {{#if (eq action 'converted_to_free')}}
                <p>✅ Your account has been automatically moved to our <strong>Free Tier</strong></p>
                <p>✅ You can continue using basic features at no cost</p>
                <p>✅ All your data remains safe and accessible</p>
                <p>✅ You can upgrade to a paid plan anytime</p>
                {{else}}
                <p>• Your trial access has ended</p>
                <p>• Your account is now inactive</p>
                <p>• Your data remains safe for 30 days</p>
                <p>• You can reactivate by choosing a plan</p>
                {{/if}}
            </div>
            
            <p>Ready to unlock the full potential of our platform? Choose a plan that fits your needs:</p>
            
            <p style="text-align: center;">
                <a href="{{pricingUrl}}" class="btn btn-primary">Choose Your Plan</a>
                {{#if (eq action 'converted_to_free')}}
                <a href="{{dashboardUrl}}" class="btn">Go to Dashboard</a>
                {{/if}}
            </p>
            
            <p>We hope you enjoyed your trial experience and we'd love to have you as a customer!</p>
        </div>
        
        <div class="footer">
            <p>Questions? Our team is here to help you choose the right plan!</p>
        </div>
    </div>
</body>
</html>
      `,
      text_body: `
Your Trial Has Ended

Your trial period has come to an end. Thank you for exploring our platform!

What Happens Now?
{{#if (eq action 'converted_to_free')}}
✅ Your account has been automatically moved to our Free Tier
✅ You can continue using basic features at no cost
✅ All your data remains safe and accessible
✅ You can upgrade to a paid plan anytime
{{else}}
• Your trial access has ended
• Your account is now inactive
• Your data remains safe for 30 days
• You can reactivate by choosing a plan
{{/if}}

Ready to unlock the full potential of our platform? Choose a plan that fits your needs:

Choose Your Plan: {{pricingUrl}}
{{#if (eq action 'converted_to_free')}}
Go to Dashboard: {{dashboardUrl}}
{{/if}}

We hope you enjoyed your trial experience and we'd love to have you as a customer!

Questions? Our team is here to help you choose the right plan!
      `,
      variables: JSON.stringify(['action', 'pricingUrl', 'dashboardUrl']),
      is_active: true,
    },
  ]);
};
