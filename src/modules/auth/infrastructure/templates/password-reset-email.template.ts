export function buildPasswordResetEmail(resetLink: string): string {
  return `
  <!DOCTYPE html>
  <html>
    <body style="margin:0; padding:0; background-color:#f4f4f7; font-family:'Segoe UI', Tahoma, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
              <tr>
                <td style="background:linear-gradient(135deg, #6366f1, #8b5cf6); padding:32px; text-align:center;">
                  <h1 style="color:#ffffff; margin:0; font-size:22px;">🔑 Reset Your Password</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px; color:#333333;">
                  <p style="font-size:15px; line-height:1.6;">
                    Hi there,
                  </p>
                  <p style="font-size:15px; line-height:1.6;">
                    We received a request to reset your password for your <strong>Helper</strong> account.
                    Click the button below to choose a new password. This link is valid for
                    <strong>15 minutes</strong>.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding:24px 0;">
                        <a href="${resetLink}"
                           style="background:#6366f1; color:#ffffff; text-decoration:none;
                                  padding:14px 32px; border-radius:8px; font-size:15px;
                                  font-weight:600; display:inline-block;">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="font-size:13px; color:#888888; line-height:1.6;">
                    If you didn't request this, you can safely ignore this email —
                    your password will remain unchanged.
                  </p>
                  <p style="font-size:12px; color:#aaaaaa; word-break:break-all; margin-top:16px;">
                    Or copy this link: ${resetLink}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#f9f9fb; padding:16px; text-align:center;">
                  <p style="font-size:12px; color:#999999; margin:0;">
                    © ${new Date().getFullYear()} Helper. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}