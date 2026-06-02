import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { google } from 'googleapis';

function buildMimeMessage(to: string[], subject: string, messageHtml: string, files: File[]): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const toHeader = to.join(', ');
      
      let emailLines = [
        `To: ${toHeader}`,
        `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        messageHtml,
        ''
      ];

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        const encodedFileName = `=?utf-8?B?${Buffer.from(file.name).toString('base64')}?=`;

        emailLines.push(
          `--${boundary}`,
          `Content-Type: ${file.type || 'application/octet-stream'}; name="${encodedFileName}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${encodedFileName}"`,
          '',
          base64Data,
          ''
        );
      }

      emailLines.push(`--${boundary}--`);

      const email = emailLines.join('\r\n');
      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      resolve(encodedEmail);
    } catch (e) {
      reject(e);
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Extraer sesión de Supabase
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return NextResponse.json({ error: 'No autorizado. Inicia sesión de nuevo.' }, { status: 401 });
    }

    const providerToken = session.provider_token;
    const providerRefreshToken = session.provider_refresh_token;

    if (!providerToken) {
      return NextResponse.json(
        { error: 'No se encontraron tokens de Google en la sesión actual. Recuerda la advertencia: Supabase solo los entrega en el login inicial. Debes reconectar.' }, 
        { status: 403 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: providerToken,
      refresh_token: providerRefreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const formData = await request.formData();
    const to = formData.getAll('to') as string[];
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;
    const attachments = formData.getAll('attachments') as File[];
    
    if (!to || to.length === 0 || !subject || !message) {
       return NextResponse.json({ error: 'Faltan campos obligatorios: to, subject, message' }, { status: 400 });
    }

    const rawEmail = await buildMimeMessage(to, subject, message, attachments);

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawEmail },
    });

    return NextResponse.json({ success: true, messageId: res.data.id });

  } catch (error: any) {
    console.error('[GMAIL_SEND_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Error interno al enviar correo' }, { status: 500 });
  }
}
