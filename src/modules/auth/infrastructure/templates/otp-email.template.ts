export function buildOtpEmail(code: string, expiresInSeconds: number): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <body style="margin:0;padding:32px;background:#f4f4f7;font-family:Arial,sans-serif;color:#333">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="max-width:100%;background:#fff;border-radius:12px;padding:32px">
                <tr>
                  <td align="center">
                    <h1 style="margin:0 0 16px;color:#6366f1;font-size:22px">Helper verification code</h1>
                    <p style="font-size:15px;line-height:1.6">Use this code to verify your account:</p>
                    <p style="margin:24px 0;font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
                    <p style="font-size:13px;color:#777">This code expires in ${expiresInSeconds} seconds. If you didn't request it, you can ignore this email.</p>
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
