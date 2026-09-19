import nodemailer from 'nodemailer';


interface EmailAttachment {
    filename: string;
    content: string;
    encoding: 'base64';
    contentType: string;
}

export async function sendEmail(config: any, to: string, subject: string, html: string, attachments: EmailAttachment[] = []) {
    if (!config?.host || !config?.user || !config?.pass) {
        throw new Error('E-mail integration not configured');
    }

    const { host, port, user, pass, from } = config;

    const transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: {
            user,
            pass
        }
    });

    return await transporter.sendMail({
        from: from || user,
        to,
        subject,
        html,
        attachments,
    });
}
