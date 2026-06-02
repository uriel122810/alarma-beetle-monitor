import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const providerToken = session.provider_token;

    if (!providerToken) {
      return NextResponse.json(
        { error: 'Sin tokens de proveedor', count: 0 }, 
        { status: 403 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: providerToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch unread messages
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults: 1 // We only need to know if there are any, but resultSizeEstimate will give us the count
    });

    const count = res.data.resultSizeEstimate || 0;

    return NextResponse.json({ count });

  } catch (error: any) {
    console.error('[GMAIL_UNREAD_ERROR]', error);
    // Ignore error silently to not spam logs if scope is missing, just return 0
    return NextResponse.json({ count: 0, error: error.message }, { status: 200 });
  }
}
