import { google } from 'googleapis';
import { createOAuth2Client } from './client';
import { decrypt, encrypt } from '../encryption';

// Importamos el cliente admin de Supabase dinámicamente para evitar
// problemas de módulo en el bundle del cliente
async function getAdminClient() {
  const { createSupabaseAdminClient } = await import('../supabase/admin');
  return createSupabaseAdminClient();
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  data: string; // Base64 del archivo
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  htmlBody: string;
  attachments?: EmailAttachment[];
}

// ─── Construcción del mensaje MIME ────────────────────────────────────────────

/**
 * Construye un mensaje MIME multipart/mixed en formato RFC 2822.
 * Soporta cuerpo HTML y múltiples archivos adjuntos en Base64.
 */
function buildMimeMessage(from: string, payload: EmailPayload): string {
  const boundary = `boundary_corp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const to = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;

  // Codifica el subject en Base64 para soportar caracteres especiales (UTF-8)
  const encodedSubject = `=?UTF-8?B?${Buffer.from(payload.subject).toString('base64')}?=`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join('\r\n');

  const htmlPart = [
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(payload.htmlBody, 'utf8').toString('base64'),
  ].join('\r\n');

  const attachmentParts = (payload.attachments ?? [])
    .map((att) =>
      [
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        att.data,
      ].join('\r\n')
    )
    .join('\r\n');

  const body = [headers, '', htmlPart, attachmentParts, `--${boundary}--`]
    .filter(Boolean)
    .join('\r\n');

  // Codifica en base64url (requerido por Gmail API)
  return Buffer.from(body).toString('base64url');
}

// ─── Obtener cliente Gmail autenticado del usuario ────────────────────────────

/**
 * Recupera los tokens OAuth del usuario desde Supabase,
 * los descifra y configura un OAuth2Client listo para usar.
 * Si el access_token expira, googleapis lo refresca automáticamente
 * y el listener actualiza los tokens en la BD.
 */
async function getUserGmailClient(userId: string) {
  const supabase = await getAdminClient();

  const { data: tokenRow, error } = await supabase
    .from('oauth_tokens')
    .select('access_token, refresh_token, expiry_date')
    .eq('user_id', userId)
    .single();

  if (error || !tokenRow) {
    throw new Error(
      `No se encontraron tokens de Gmail para el usuario ${userId}. ` +
      'El usuario debe conectar su cuenta de Google en Configuración.'
    );
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decrypt(tokenRow.access_token),
    refresh_token: decrypt(tokenRow.refresh_token),
    expiry_date: tokenRow.expiry_date
      ? new Date(tokenRow.expiry_date).getTime()
      : undefined,
  });

  // Listener: si googleapis refresca el token, actualizamos en BD
  oauth2Client.on('tokens', async (newTokens) => {
    const updateData: Record<string, string> = {};
    if (newTokens.access_token) {
      updateData.access_token = encrypt(newTokens.access_token);
    }
    if (newTokens.expiry_date) {
      updateData.expiry_date = new Date(newTokens.expiry_date).toISOString();
    }
    if (Object.keys(updateData).length > 0) {
      await supabase.from('oauth_tokens').update(updateData).eq('user_id', userId);
    }
  });

  return oauth2Client;
}

// ─── Función principal de envío ───────────────────────────────────────────────

/**
 * Envía un correo electrónico en nombre del usuario usando su token OAuth.
 * @param userId        UUID del usuario en Supabase
 * @param senderEmail   Formato: "Nombre Apellido <email@dominio.com>"
 * @param payload       Destinatarios, asunto, cuerpo HTML y adjuntos
 */
export async function sendEmailAsUser(
  userId: string,
  senderEmail: string,
  payload: EmailPayload
): Promise<{ messageId: string }> {
  const auth = await getUserGmailClient(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  const rawMessage = buildMimeMessage(senderEmail, payload);

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawMessage },
  });

  if (!response.data.id) {
    throw new Error('Gmail API no retornó un ID de mensaje');
  }

  return { messageId: response.data.id };
}
