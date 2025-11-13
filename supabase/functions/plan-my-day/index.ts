import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Task {
  id: string;
  title: string;
  description?: string;
  est_min?: number;
  priority: number;
  impact: number;
  due_at?: string;
  tags?: string[];
  project?: string;
  energy_need: number;
  min_block_min: number;
  location?: string;
  earliest_start?: string;
  hard_window_start?: string;
  hard_window_end?: string;
}

interface Ritual {
  id: string;
  name: string;
  duration_min: number;
  preferred_start?: string;
  preferred_end?: string;
  hard_fixed: boolean;
  days_of_week?: string[];
  location?: string;
  pre_buffer_min: number;
  post_buffer_min: number;
}

interface Event {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  hard_fixed: boolean;
}

interface Profile {
  build_mode: boolean;
  home_city: string;
  work_arrival?: string;
  work_leave?: string;
  friday_home_office: boolean;
  bedtime?: string;
  prebed_start?: string;
}

interface WhoopData {
  recovery_pct?: number;
  hrv_ms?: number;
  rhr_bpm?: number;
  sleep_perf_pct?: number;
}

interface DailyHistory {
  date: string;
  lunch_meal?: string;
  dinner_meal?: string;
  workout_type?: string;
  workout_exercises?: any;
  workout_completed?: boolean;
  recovery_pct?: number;
  hrv_ms?: number;
  sleep_hours?: number;
  tasks_completed?: number;
  total_work_minutes?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key for single-user app (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Single-user mode: use static user ID
    const userId = '00000000-0000-0000-0000-000000000001';
    console.log('Planning day (single-user mode)');

    // Build AI prompt - accept target date from request or default to tomorrow
    const body = await req.json().catch(() => ({}));
    const targetDateStr = body.targetDate;
    const userNotes = body.userNotes || '';
    
    const today = new Date();
    let planningDate: Date;
    
    if (targetDateStr) {
      planningDate = new Date(targetDateStr);
      console.log('🗓️ Planning for specified date:', planningDate.toISOString());
    } else {
      // Default to tomorrow if no date specified
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      planningDate = tomorrow;
      console.log('🗓️ No date specified, defaulting to tomorrow:', planningDate.toISOString());
    }

    // Calculate date range for history (last 7 days from today)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // Fetch all required data (all optional - will work with empty DB)
    const [tasksRes, ritualsRes, eventsRes, profileRes, whoopRes, historyRes, recentBlocksRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('status', 'todo'),
      supabase.from('rituals').select('*'),
      supabase.from('events').select('*').gte('start_at', new Date().toISOString()),
      supabase.from('profiles').select('*').single(),
      supabase.from('whoop_daily').select('*').eq('date', new Date().toISOString().split('T')[0]).single(),
      supabase.from('daily_history').select('*').gte('date', sevenDaysAgoStr).order('date', { ascending: false }),
      supabase.from('blocks').select('*').gte('start_at', sevenDaysAgo.toISOString()).in('type', ['meal', 'ritual']).order('start_at', { ascending: false })
    ]);

    const tasks: Task[] = tasksRes.data || [];
    const rituals: Ritual[] = ritualsRes.data || [];
    const events: Event[] = eventsRes.data || [];
    const history: DailyHistory[] = historyRes.data || [];
    const recentBlocks = recentBlocksRes.data || [];
    
    // Use database profile or sensible defaults
    const profileData = profileRes.data;
    const profile: Profile = {
      build_mode: profileData?.build_mode ?? true,
      home_city: profileData?.home_city ?? 'BA',
      work_arrival: profileData?.work_arrival ?? '08:30:00',
      work_leave: profileData?.work_leave ?? '16:30:00',
      friday_home_office: profileData?.friday_home_office ?? true,
      bedtime: profileData?.bedtime ?? '22:00:00',
      prebed_start: profileData?.prebed_start ?? '21:30:00'
    };
    
    const whoopData = whoopRes.data;
    const whoop: WhoopData = {
      recovery_pct: whoopData?.recovery_pct,
      hrv_ms: whoopData?.hrv_ms,
      rhr_bpm: whoopData?.rhr_bpm,
      sleep_perf_pct: whoopData?.sleep_perf_pct
    };

    console.log(`Loaded: ${tasks.length} tasks, ${rituals.length} rituals, ${events.length} events, ${history.length} history entries`);
    
    // If no data exists, AI will create a balanced template day
    if (tasks.length === 0 && rituals.length === 0 && events.length === 0) {
      console.log('No tasks/rituals/events found - will generate template schedule');
    }

    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][planningDate.getDay()];
    const isWorkday = planningDate.getDay() >= 1 && planningDate.getDay() <= 5;
    const isFriday = planningDate.getDay() === 5;

    // Calculate wake time from bedtime and sleep target
    const bedtimeHours = parseInt(profile.bedtime?.split(':')[0] || '22');
    const bedtimeMinutes = parseInt(profile.bedtime?.split(':')[1] || '0');
    const prebedHours = parseInt(profile.prebed_start?.split(':')[0] || '21');
    const prebedMinutes = parseInt(profile.prebed_start?.split(':')[1] || '30');
    
    // Wake time is bedtime + 8 hours (default sleep target)
    const wakeHours = (bedtimeHours + 8) % 24;
    const wakeTime = `${String(wakeHours).padStart(2, '0')}:00`;
    const buildModeStart = `${String(wakeHours).padStart(2, '0')}:10`;
    const buildModeEnd = `${String((wakeHours + 2) % 24).padStart(2, '0')}:00`;
    
    // Build historical context strings
    const mealHistory = history.length > 0 
      ? history.map(h => `${h.date}: Lunch=${h.lunch_meal || 'N/A'}, Dinner=${h.dinner_meal || 'N/A'}`).join('\n')
      : 'No meal history available';
    
    const workoutHistory = history.length > 0
      ? history.map(h => `${h.date}: ${h.workout_type || 'Rest'} ${h.workout_completed ? '✓' : '✗'}`).join('\n')
      : 'No workout history available';

    // Extract recent meals to avoid repetition
    const recentLunchMeals = history.slice(0, 3).map(h => h.lunch_meal).filter(Boolean);
    const recentDinnerMeals = history.slice(0, 3).map(h => h.dinner_meal).filter(Boolean);

    const systemPrompt = `You are ChronoPilot's scheduling engine. Plan a personalized day for TOMORROW ${planningDate.toISOString().split('T')[0]} (${dayOfWeek}) in Europe/Bratislava timezone.

${userNotes ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CRITICAL USER CONTEXT - MUST BE PRIORITIZED IN PLANNING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userNotes}

⚠️ MANDATORY: These user notes are CRITICAL CONTEXT and must directly influence:
1. Gym cycle planning (adjust based on yesterday's workout)
2. Meal rotation (avoid recently eaten meals)
3. Task priorities (respect mentioned deadlines and urgency)
4. Energy levels (if user mentions being tired, schedule lighter tasks)
5. Time constraints (if user mentions current time, adjust schedule accordingly)

DO NOT ignore these notes - they represent the user's current state and needs!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

` : ''}REAL DAY EXAMPLE (for reference - match this level of granularity):
06:00 Wake
06:00–06:02 30 push-ups (2 min) - Fixed
06:02–06:04 Brush my teeth - Fixed
06:04–06:06 Get dressed - Fixed
06:06–06:08 Weight my self - Fixed
06:08–06:14 Think through "Jojka" (6 min)
06:14–06:20 Think through tasking (6 min)
06:20–06:30 Spinal rotation exercises (10 min)
06:30–06:55 Work on presentation (25 min)
06:55–07:00 Slice potatoes (5 min)
07:00–07:30 Run (30 min) - Fixed
07:30–07:40 Shower (10 min) - Fixed
07:40–07:50 Finish cooking (done by 07:50) - Fixed
07:50–08:00 Read (to 08:00) - Fixed
08:00–08:10 Pack
08:10–08:30 Commute to office
08:30–09:00 Team stand-up ("Porada")
09:00–09:30 Matica
09:30–10:00 Mid-year goals ("Polročné ciele")
10:00–10:30 Publish updates ("Nahodiť novinky")
10:30–11:00 Resize MagicStyle
11:00–12:00 Sofi Heureka
12:00–12:45 Lunch: Potatoes with chicken breast (fixed)
12:45–13:30 Matej – video
13:30–14:00 Matica
14:00–14:30 MediaToolKit with Idka
14:30–15:00 Matica meeting
15:00–15:45 Ad hoc
15:45–16:00 Plans for tomorrow
16:00–16:45 Commute home
16:50–16:55 Walk/commute to gym
17:00–18:25 Gym | Push (fixed, finish by 18:30)
18:25–18:30 Return home
18:35–19:05 Dinner (bread with ham, cheese, butter, vegetables) + Omega-3 & D3 (+ Creatine post-workout) — fixed, done by 19:30
19:35–20:00 Walk (25 min) — fixed, done by 20:00
20:00–21:00 If needed: work (max 1h); otherwise reading/podcast/business videos — fixed ceiling 21:30
21:30–21:40 Yoga (10 min) (fixed)
21:40–21:50 Meditation (10 min) (fixed)
21:50–21:53 Brush teeth (3 min) (fixed)
by 22:00 Sleep (fixed)

CRITICAL: Match this granularity! Include:
- 2-6 minute micro-blocks for morning routine (push-ups, brush teeth, get dressed, weigh self)
- 5-10 minute meal prep blocks (slice potatoes, finish cooking)
- Specific thinking/planning blocks (6min each)
- "Plans for tomorrow" block (10-15min before evening commute)
- "Ad hoc" buffer blocks for unexpected work
- Evening walk (25min FIXED after dinner, around 19:35-20:00)
- Pre-sleep routine broken into yoga, meditation, brush teeth

LAST 7 DAYS HISTORY:

Meals eaten:
${mealHistory}

Workout cycle tracking:
${workoutHistory}

MEAL ROTATION RULES:
- Recent lunches (avoid repeating): ${recentLunchMeals.join(', ') || 'none'}
- Recent dinners (avoid repeating): ${recentDinnerMeals.join(', ') || 'none'}
- Don't repeat same base OR main within last 3 days
- Available bases: rice, potatoes, fries, pasta
- Available mains: salmon, steak, chicken, turkey, tuna, legumes
- MUST specify lunch as "base with main" (e.g., "Rice with salmon")

WORKOUT PROGRESSION:
${history.length > 0 ? `- Last workout: ${history[0].workout_type || 'N/A'} ${history[0].workout_completed ? '✓' : '✗'}
- Cycle position: Use Push → Pull → Legs → Active → Push → Pull → Legs pattern
- Progressive overload: If last 2 same workouts successful → suggest +5kg on main lifts` : '- Starting fresh cycle: Push → Pull → Legs → Active'}

USER PROFILE & DAILY ROUTINE (ALL TIMES IN Europe/Bratislava timezone):
- Wake time: ${wakeTime} EXACTLY
- Build mode focus (SACRED): ${buildModeStart}-${buildModeEnd} EXACTLY - highest priority cognitive/deep work
  * Prioritize based on tasks: urgent PS Digital work > ChronoPilot > personal projects/learning
  * Can be interrupted by journaling block if important project/decision requires it
- Running: START at 07:00 weekdays, 07:30 weekends (30min duration, schedule when possible)
- Shower: 10 MINUTES duration (start 07:40 weekdays, 08:00 weekends)
- Breakfast: NONE (user does not eat breakfast)
- Lunch: 12:00-12:45 EXACTLY (45min FIXED window)
  * MUST specify actual meal from rotation: base (rice/potatoes/fries/pasta) + main (salmon/steak/chicken/turkey/tuna/legumes)
  * Example: "Lunch: Rice with grilled salmon" or "Lunch: Potatoes with chicken breast"
- Pre-bed routine: starts ${profile.prebed_start} EXACTLY
- Lights out: ${profile.bedtime} EXACTLY
- Sleep goal: 7-8 hours (minimum 6.5h), optimize for quality

WORK SCHEDULE:
- Mon-Thu: On-site in office (arrive 08:30, leave 16:30)
- Fri: Home office
- Current priority: work on ChronoPilot app during morning build mode
- Meetings: few; sync from Outlook calendar

TRAINING & EXERCISE (6x per week):
- Gym split cycle: Push → Pull → Legs → Active (swim/sauna/walk) → Push → Pull → Legs
- Typical time: 17:00-18:00/18:30 Mon-Sat
- Progressive overload: +10% weight after 2 successful consecutive weeks; -5% if missed twice
- Football: Thursday variable time (17:00-18:30 window), optional, can replace gym as Active day
- Swimming: 17:00-18:30, use on Active/Rest days, prefer over sauna for cost reasons
- Sunday special: If hockey at 16:00, gym after hockey at 18:30-19:30
- Running: Already covered in daily routine above
- Yoga: 10-15min before bed
- Meditation: 10min before bed

SPORTS SCHEDULE (HARD-FIXED):
- Hockey team: HK Spišská Nová Ves
- Sunday games: Typically 16:00-18:00 (4 PM to 6 PM) - schedule automatically on Sundays unless event table has different time
- Games: Use EXACT times from events table if available (e.g., 15:50-19:10), otherwise use default Sunday 16:00-18:00
- CRITICAL: Display hockey blocks using the EXACT start_at and end_at times from events - do NOT round to nearest hour
- Add ±10min pre/post buffers for hockey games if not already included
- Verify schedule daily from feed

NUTRITION:
- Lunch: 12:00-12:45 (FIXED) - base (rice, potatoes, fries, pasta) + main (salmon, steak, chicken, turkey, tuna, legumes)
- Dinner: simple meals - bread with ham, bread with eggs, or yogurt with cereals
- Hockey game days: eat dinner BEFORE or DURING hockey game (not after gym)

SUPPLEMENTS:
- With dinner: Omega-3, Vitamin D3
- Training days: Creatine 3g (post-workout with dinner preferred; fallback: 30min pre-workout if dinner irregular)
- 90min before sleep: Magnesium, Ashwagandha
- Adjust pre-sleep timing dynamically using WHOOP predicted/last sleep

LOCATIONS:
- Default: Bratislava
- Gym commute: 5 minutes from home
- Secondary: Spišská Nová Ves (roughly once per month)
- Upcoming trip: Week of 2025-11-01 in SNV

PLANNING PREFERENCES:
- Heavy tasks first (frontload cognitive work)
- Build mode morning block 06:10-08:00 is SACRED (but can flex for journaling if needed)
- Minimize context switching (cluster by tags/projects)
- Breaks: 5-10min every 50-90min
- Day buffer: 10-15% unscheduled time
- Hard-fixed events ALWAYS respected
- Digital detox: Every other Saturday - suppress screen-heavy tasks, prefer gym/swimming/groceries/analog activities

SCHEDULING RULES (CRITICAL - USE EXACT TIMES):
1. ALL BLOCKS MUST HAVE MINIMUM 5-MINUTE DURATION - never create 0-duration blocks
2. Pack hard-fixed events first (events + rituals with hard_fixed=true, hockey games)
3. Build mode ${buildModeStart}-${buildModeEnd} EXACTLY: prioritize urgent PS Digital tasks > ChronoPilot > personal projects
   - If tasks require journaling, schedule it during build mode, shift deep work after
4. WORK HOURS ALLOCATION (${isWorkday ? '08:30-16:00' : 'N/A - weekend'}):
   - Work hours (Mon-Thu 08:30-16:00): ONLY schedule PS:Digital work tasks (MagicStyle, MediaToolKit)
   - Personal projects (TatryStay, A+ Memory, Chronopilot/AI Planning, Archnes): schedule ONLY on weekends or before/after work hours
   - Exception: PS:Digital tasks can spill outside work hours ONLY if they have highest priority AND tight deadline
   - Personal projects NEVER go into work hours, even if high priority
5. Score tasks: (impact * 3) + (priority * 2) + (urgency_score) - (energy_mismatch_penalty)
6. Cluster by tags/projects to minimize context switching
7. Breaks: use "buffer" type for 5-10min rest every 50-90min
8. Meals: 
   - Lunch: 12:00-12:45 EXACTLY (use "meal" type, MUST specify: base + main e.g. "Rice with salmon")
   - Dinner: simple meal (use "meal" type, specify: "Bread with ham", "Bread with eggs", or "Yogurt with cereals")
   - Hockey days: schedule dinner BEFORE/DURING hockey game, NOT after gym
   - NO breakfast
9. Exercise (use "ritual" type for all): 
   - Running: START at 07:00 weekdays / 07:30 weekends, 30min duration
   - Shower: 10 MINUTES (start 07:40 weekdays / 08:00 weekends)
   - Gym: 17:00-18:30 Mon-Sat per PPL-Active-PPL cycle (5min commute)
   - Football: Thu 17:00-18:30 (optional, replaces gym as Active)
   - Swimming: 17:00-18:30 on Active/Rest days (prefer over sauna)
   - Hockey: Use EXACT times from events (e.g., 15:50-19:10) - do NOT round to hour
   - Sunday: If hockey scheduled, gym after at 18:30-19:30
   - Yoga: 10-15min before bed
   - Meditation: 10min before bed
10. Supplements: 
    - Dinner: Omega-3, D3, Creatine (on training days)
    - 90min before sleep: Magnesium, Ashwagandha
11. Sleep: MUST be a continuous block from bedtime (${profile.bedtime}) to wake time (${wakeTime} next day)
    - Use type "sleep" for the main sleep block
    - Pre-bed routine (${profile.prebed_start}-${profile.bedtime}) should be separate with type "ritual"
    - Sleep block format: start_at: "2025-10-26T${profile.bedtime}:00+01:00", end_at: "2025-10-27T${wakeTime}:00+01:00"
12. Day buffer: leave 10-15% unscheduled
13. If WHOOP recovery <40%, prioritize active recovery over intense work
14. Respect location constraints (home vs office vs any)
15. Honor earliest_start, hard_window_start, hard_window_end if present
16. Commute: 5min to gym, factor in office commute Mon-Thu
17. Digital detox Saturday (every other): suppress screen tasks, prefer gym/swim/analog activities
18. TIMEZONE: All times in Europe/Bratislava (UTC+1/+2), use ISO 8601 format with timezone offset
19. NO OVERLAPS: Ensure each block ends exactly when the next begins (or leave buffer time between)
20. AVOID EARLY MORNING SCHEDULING: Do not schedule work/tasks before ${wakeTime} unless explicitly required

WHOOP DATA TODAY:
- Recovery: ${whoop.recovery_pct || 'N/A'}%
- HRV: ${whoop.hrv_ms || 'N/A'}ms
- RHR: ${whoop.rhr_bpm || 'N/A'}bpm
${whoop.recovery_pct && whoop.recovery_pct < 40 ? '\n⚠️ LOW RECOVERY - prioritize active recovery, reduce intensity' : ''}

OUTPUT FORMAT:
Return ONLY a JSON array of blocks (no markdown, no explanation):
[
  {
    "title": "Block title",
    "start_at": "2025-10-26T06:10:00+01:00",
    "end_at": "2025-10-26T08:00:00+01:00",
    "type": "task" | "ritual" | "event" | "meal" | "sleep" | "buffer" | "commute",
    "status": "planned",
    "task_id": "uuid or null",
    "ritual_id": "uuid or null",
    "notes": "Optional context"
  }
]

IMPORTANT: Use "ritual" type for all exercise-related activities (running, shower, gym, yoga, meditation, etc.)

CRITICAL TIMING REQUIREMENTS:
- ALL times MUST use Europe/Bratislava timezone (UTC+1 in winter, UTC+2 in summer)
- Use ISO 8601 format with EXPLICIT timezone offset: "2025-10-26T07:00:00+01:00" (NOT "Z", NOT "06:00:00+00:00")
- TIMEZONE OFFSET: Always use +01:00 for winter (Oct-Mar) or +02:00 for summer (Apr-Sep)
- DO NOT shift times - if prompt says 07:00 local time, write "2025-10-26T07:00:00+01:00"
- Example: Wake at ${wakeTime} = "2025-10-26T${wakeTime}:00+01:00", NOT "2025-10-26T${String(wakeHours - 1).padStart(2, '0')}:00:00Z"
- Sleep MUST span overnight: "2025-10-26T${profile.bedtime}:00+01:00" to "2025-10-27T${wakeTime}:00+01:00"
- Ensure no overlaps between blocks
- Fill the entire day ${wakeTime}-${profile.bedtime} with planned activities`;

    const userPrompt = `
TASKS (${tasks.length}):
${tasks.length > 0 ? tasks.map(t => `- "${t.title}" [${t.est_min || 60}min, priority=${t.priority}, impact=${t.impact}, energy=${t.energy_need}, tags=${t.tags?.join(',') || 'none'}] ${t.due_at ? `DUE: ${t.due_at}` : ''}`).join('\n') : '(No tasks - create a balanced day with deep work, breaks, meals, and personal time)'}

RITUALS (${rituals.length}):
${rituals.length > 0 ? rituals.map(r => `- "${r.name}" [${r.duration_min}min, ${r.hard_fixed ? 'HARD-FIXED' : 'flexible'}, preferred=${r.preferred_start || 'any'}, days=${r.days_of_week?.join(',') || 'all'}]`).join('\n') : '(No rituals - suggest standard morning routine, exercise, meals, and wind-down)'}

EVENTS (${events.length}):
${events.length > 0 ? events.map(e => `- "${e.title}" [${e.start_at} to ${e.end_at}, ${e.hard_fixed ? 'HARD-FIXED' : 'flexible'}]`).join('\n') : '(No events)'}

Generate optimal schedule as JSON array. If no tasks/rituals exist, create a productive template day with:
- Deep work block (${buildModeStart}-${buildModeEnd} EXACTLY)
- Running (START 07:00 weekdays / 07:30 weekends, 30min)
- Shower (START 07:40 weekdays / 08:00 weekends, 10min)
- Focused work sessions with breaks
- Lunch (12:00-12:45 EXACTLY) - MUST specify meal: "[base] with [main]" e.g. "Rice with salmon"
- Afternoon work/projects
- Exercise time (gym/football/swimming per schedule)
- Dinner (simple: "Bread with ham", "Bread with eggs", or "Yogurt with cereals" + supplements on training days)
- Hockey days: dinner before/during game, NOT after
- Evening wind-down (yoga + meditation)
- Bedtime routine (${profile.prebed_start}-${profile.bedtime} EXACTLY)`;


    console.log('Calling Lovable AI...');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      // Try to parse error details
      let errorMessage = `AI Gateway error: ${aiResponse.status}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMessage = errorData.message;
          if (aiResponse.status === 402) {
            errorMessage = 'Insufficient AI credits. Please check your Lovable account credits.';
          }
        }
      } catch (e) {
        // If parsing fails, use generic message
      }
      
      throw new Error(errorMessage);
    }

    const aiData = await aiResponse.json();
    let generatedText = aiData.choices[0].message.content;
    console.log('AI raw response:', generatedText.substring(0, 200));

    // Clean markdown and control characters
    generatedText = generatedText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim();

    let blocks;
    try {
      blocks = JSON.parse(generatedText);
      console.log(`Generated ${blocks.length} blocks`);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Cleaned response:', generatedText.substring(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }

    // Helper function to format dates with Europe/Bratislava timezone offset
    const formatWithTimezoneOffset = (date: Date): string => {
      // Detect DST (Daylight Saving Time) for Europe/Bratislava
      const jan = new Date(date.getFullYear(), 0, 1);
      const jul = new Date(date.getFullYear(), 6, 1);
      const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
      const isDST = date.getTimezoneOffset() < stdOffset;
      const offset = isDST ? '+02:00' : '+01:00';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
    };

    // Log AI-generated blocks for debugging
    console.log('AI-generated blocks (first 3):');
    blocks.slice(0, 3).forEach((b: any) => {
      console.log(`  - "${b.title}": ${b.start_at} to ${b.end_at}`);
    });

    // Fix 0-duration blocks
    blocks = blocks.map((block: any) => {
      const start = new Date(block.start_at);
      const end = new Date(block.end_at);
      const durationMs = end.getTime() - start.getTime();
      
      if (durationMs <= 0) {
        console.warn(`Fixing 0-duration block: "${block.title}"`);
        const fixedEnd = new Date(start.getTime() + 30 * 60 * 1000);
        block.end_at = formatWithTimezoneOffset(fixedEnd);
      }
      
      return block;
    });

    // Validate and fix sleep block
    const sleepBlock = blocks.find((b: any) => 
      b.type === 'sleep' || 
      b.title.toLowerCase().includes('sleep') || 
      b.title.toLowerCase().includes('lights')
    );

    if (sleepBlock) {
      const sleepStart = new Date(sleepBlock.start_at);
      const sleepEnd = new Date(sleepBlock.end_at);
      const sleepDurationHours = (sleepEnd.getTime() - sleepStart.getTime()) / (1000 * 60 * 60);
      
      // If sleep duration is wrong, fix it using profile settings
      if (sleepDurationHours < 6 || sleepDurationHours > 10) {
        console.warn(`Fixing sleep block duration: "${sleepBlock.title}" (was ${sleepDurationHours.toFixed(1)}h)`);
        const sleepStartDate = new Date(planningDate);
        sleepStartDate.setHours(bedtimeHours, bedtimeMinutes, 0, 0);
        
        const sleepEndDate = new Date(sleepStartDate);
        sleepEndDate.setDate(sleepEndDate.getDate() + 1);
        sleepEndDate.setHours(wakeHours, 0, 0, 0);
        
        sleepBlock.start_at = formatWithTimezoneOffset(sleepStartDate);
        sleepBlock.end_at = formatWithTimezoneOffset(sleepEndDate);
      }
    }

    // Add sleep block if missing
    if (!sleepBlock) {
      console.warn('No sleep block found - adding default sleep block');
      const sleepStartDate = new Date(planningDate);
      sleepStartDate.setHours(bedtimeHours, bedtimeMinutes, 0, 0);
      const sleepEndDate = new Date(sleepStartDate);
      sleepEndDate.setDate(sleepEndDate.getDate() + 1);
      sleepEndDate.setHours(wakeHours, 0, 0, 0);
      
      blocks.push({
        title: 'Sleep',
        start_at: formatWithTimezoneOffset(sleepStartDate),
        end_at: formatWithTimezoneOffset(sleepEndDate),
        type: 'sleep',
        status: 'planned',
        task_id: null,
        ritual_id: null,
        notes: 'Target: 8 hours'
      });
    }

    // Sort blocks by start time
    blocks.sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    // Fix overlapping blocks
    for (let i = 0; i < blocks.length - 1; i++) {
      const currentEnd = new Date(blocks[i].end_at);
      const nextStart = new Date(blocks[i + 1].start_at);
      
      if (currentEnd > nextStart) {
        console.warn(`Overlap detected: ${blocks[i].title} (ends ${currentEnd.toISOString()}) overlaps with ${blocks[i + 1].title} (starts ${nextStart.toISOString()})`);
        // Fix: adjust current block's end time to match next block's start
        blocks[i].end_at = blocks[i + 1].start_at;
      }
    }

    // Match task blocks to actual tasks in database
    console.log('Matching task blocks to database tasks...');
    const taskBlocks = blocks.filter((b: any) => b.type === 'task');
    let matchedCount = 0;
    
    for (const block of taskBlocks) {
      // Try exact match first (case-insensitive)
      const blockTitle = block.title.toLowerCase().trim();
      let matchedTask = tasks.find(t => t.title.toLowerCase().trim() === blockTitle);
      
      // If no exact match, try fuzzy match (check if task title is contained in block title or vice versa)
      if (!matchedTask) {
        matchedTask = tasks.find(t => {
          const taskTitle = t.title.toLowerCase().trim();
          return blockTitle.includes(taskTitle) || taskTitle.includes(blockTitle);
        });
      }
      
      if (matchedTask) {
        block.task_id = matchedTask.id;
        matchedCount++;
        console.log(`  ✓ Matched "${block.title}" → task "${matchedTask.title}"`);
      } else {
        console.warn(`  ✗ No match for task block: "${block.title}"`);
        block.task_id = null;
      }
    }
    
    console.log(`Task matching complete: ${matchedCount}/${taskBlocks.length} blocks matched`);

    // Delete existing planned blocks for tomorrow
    const tomorrowStart = new Date(planningDate.setHours(0, 0, 0, 0)).toISOString();
    const tomorrowEnd = new Date(planningDate.setHours(23, 59, 59, 999)).toISOString();
    await supabase.from('blocks')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'planned')
      .gte('start_at', tomorrowStart)
      .lte('start_at', tomorrowEnd);

    // Insert new blocks
    const blocksToInsert = blocks.map((block: any) => ({
      ...block,
      user_id: userId,
      // Ensure IDs are valid UUIDs or null (AI sometimes returns string identifiers)
      task_id: block.task_id && block.task_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? block.task_id : null,
      ritual_id: block.ritual_id && block.ritual_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? block.ritual_id : null,
    }));

    console.log('Inserting blocks (first 3):');
    blocksToInsert.slice(0, 3).forEach((b: any) => {
      console.log(`  - "${b.title}": ${b.start_at} to ${b.end_at}`);
    });

    const { error: insertError } = await supabase.from('blocks').insert(blocksToInsert);
    if (insertError) throw insertError;

    console.log('Day planning completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      blocksCreated: blocks.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in plan-my-day:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
