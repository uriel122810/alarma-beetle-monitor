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
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: providerToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Fetch events for the current month roughly
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1);
    
    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 2);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return NextResponse.json({ items: res.data.items || [] });

  } catch (error: any) {
    console.error('[CALENDAR_GET_ERROR]', error);
    return NextResponse.json({ items: [], error: error.message }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const providerToken = session.provider_token;
    if (!providerToken) return NextResponse.json({ error: 'Sin token de Google' }, { status: 403 });

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: providerToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const { summary, description, startDateTime, endDateTime } = await request.json();

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        start: { dateTime: startDateTime, timeZone: 'America/Mexico_City' },
        end: { dateTime: endDateTime || startDateTime, timeZone: 'America/Mexico_City' },
      },
    });

    return NextResponse.json({ success: true, eventId: res.data.id });
  } catch (error: any) {
    console.error('[CALENDAR_POST_ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
