import { CreateEmailOptions, Resend } from 'resend';

const isProduction = process.env.NODE_ENV === 'production';

export const resendMailer = async (email: string): Promise<boolean> => {
  const template = ResendMailerTemplate.sendOtp(email);

  if (!isProduction) {
    await bunWriteMail(email, template.html);
    return true;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[mailer] RESEND_API_KEY missing in production');
    return false;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send(template);

  return true;
};

abstract class ResendMailerTemplate {
  static sendOtp(email: string): CreateEmailOptions {
    return {
      to: email,
      from: 'test@example.com',
      subject: 'Your OTP Login Code',
      html: `<p>Your OTP code is: <strong>${Math.floor(100000 + Math.random() * 900000)}</strong></p>`,
    };
  }
}

async function bunWriteMail(email: string, html: string | undefined) {
  const dir = 'src/modules/auth/login/_test/otp-mail';
  await Bun.$`mkdir -p ${dir}`.quiet();
  const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const nameFile = `${Date.now()}-${safeEmail}-otp.html`;
  const filePath = `${dir}/${nameFile}`;
  await Bun.write(filePath, html ?? '');
  console.log(`[mailer:dev] OTP email for ${email} written to ${filePath}`);
}
