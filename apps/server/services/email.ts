import nodemailer from 'nodemailer';


export async function sendEmail(tenantDb: any, to: string, subject: string, html: string) {
    const configDoc = await tenantDb.query.integrations.findFirst({
        where: (integrations: any, { eq }: any) => eq(integrations.id, 'email')
    });

    if (!configDoc || !configDoc.data || !configDoc.data.host) {
        throw new Error('E-mail integration not configured');
    }

    const { host, port, user, pass, from } = configDoc.data;

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
        html
    });
}
