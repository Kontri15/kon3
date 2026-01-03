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
  energy_need: number;
  min_block_min: number;
  biz_or_personal?: string;
  hard_window_start?: string;
  hard_window_end?: string;
}

interface Event {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  hard_fixed: boolean;
}

interface Ritual {
  id: string;
  name: string;
  duration_min: number;
  preferred_start?: string;
  preferred_end?: string;
  hard_fixed: boolean;
  days_of_week?: string[];
}

interface Block {
  title: string;
  start_at: string;
  end_at: string;
  type: string;
  status: string;
  user_id: string;
  task_id?: string;
  ritual_id?: string;
  description?: string;
  meal_details?: string;
  workout_details?: any;
}

interface DailyHistory {
  workout_type?: string;
  workout_completed?: boolean;
}

// Helper: Parse time string "HH:MM" to minutes from midnight
function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Helper: Get timezone offset for Europe/Bratislava (CET/CEST)
function getBratislavaOffset(date: Date): number {
  // CET (Central European Time) = UTC+1
  // CEST (Central European Summer Time) = UTC+2
  // DST in EU: last Sunday of March to last Sunday of October
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Find last Sunday of March
  const marchLast = new Date(year, 2, 31);
  const marchLastSunday = 31 - marchLast.getDay();
  
  // Find last Sunday of October
  const octLast = new Date(year, 9, 31);
  const octLastSunday = 31 - octLast.getDay();
  
  // Check if date is in DST period
  const isDST = (month > 2 && month < 9) || 
    (month === 2 && day >= marchLastSunday) ||
    (month === 9 && day < octLastSunday);
  
  return isDST ? 2 : 1; // +2 for CEST, +1 for CET
}

// Helper: Format minutes to ISO datetime for given date (in Bratislava timezone)
function minutesToIso(date: Date, minutes: number): string {
  const offset = getBratislavaOffset(date);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  // Subtract offset to get UTC time
  const utcHours = hours - offset;
  
  const d = new Date(date);
  d.setUTCHours(utcHours, mins, 0, 0);
  
  return d.toISOString();
}

// Helper: Get next workout in cycle based on history
function getNextWorkout(history: DailyHistory[]): string {
  const cycle = ['Push', 'Pull', 'Legs', 'Active/Rest'];
  const lastWorkout = history.find(h => h.workout_type && h.workout_completed);
  
  if (!lastWorkout?.workout_type) return 'Push';
  
  const lastIndex = cycle.findIndex(w => 
    lastWorkout.workout_type?.toLowerCase().includes(w.toLowerCase().split('/')[0])
  );
  
  if (lastIndex === -1) return 'Push';
  return cycle[(lastIndex + 1) % cycle.length];
}

// Helper: Check if time slot conflicts with existing blocks
function hasConflict(blocks: Block[], start: number, end: number, date: Date): boolean {
  const startIso = minutesToIso(date, start);
  const endIso = minutesToIso(date, end);
  
  return blocks.some(b => {
    const bStart = new Date(b.start_at).getTime();
    const bEnd = new Date(b.end_at).getTime();
    const sStart = new Date(startIso).getTime();
    const sEnd = new Date(endIso).getTime();
    return sStart < bEnd && sEnd > bStart;
  });
}

// Helper: Find available slot for a duration
function findSlot(blocks: Block[], duration: number, preferredStart: number, preferredEnd: number, date: Date): { start: number; end: number } | null {
  for (let start = preferredStart; start + duration <= preferredEnd; start += 5) {
    if (!hasConflict(blocks, start, start + duration, date)) {
      return { start, end: start + duration };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userId = '00000000-0000-0000-0000-000000000001';
    console.log('🚀 Code-based planning (no AI)');

    const body = await req.json().catch(() => ({}));
    const targetDateStr = body.targetDate;
    const lunchMeal = body.lunchMeal || '';
    const dinnerMeal = body.dinnerMeal || '';
    const workoutType = body.workoutType || '';

    console.log('📝 Options:', { lunchMeal, dinnerMeal, workoutType });

    // Parse target date
    const today = new Date();
    let planningDate: Date;
    
    if (targetDateStr) {
      planningDate = new Date(targetDateStr);
    } else {
      planningDate = new Date(today);
      planningDate.setDate(planningDate.getDate() + 1);
    }
    
    const dateStr = planningDate.toISOString().split('T')[0];
    const dayOfWeek = planningDate.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFriday = dayOfWeek === 5;
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
    
    console.log(`📅 Planning for ${dateStr} (${dayName}), weekend: ${isWeekend}`);

    // Fetch data
    const [tasksRes, eventsRes, ritualsRes, historyRes] = await Promise.all([
      isWeekend
        ? supabase.from('tasks').select('*').eq('status', 'todo').eq('biz_or_personal', 'personal').order('priority', { ascending: false })
        : supabase.from('tasks').select('*').eq('status', 'todo').order('priority', { ascending: false }),
      supabase.from('events').select('*').gte('start_at', `${dateStr}T00:00:00`).lt('start_at', `${dateStr}T23:59:59`),
      supabase.from('rituals').select('*'),
      supabase.from('daily_history').select('workout_type, workout_completed').order('date', { ascending: false }).limit(7),
    ]);

    const tasks: Task[] = tasksRes.data || [];
    const events: Event[] = eventsRes.data || [];
    const rituals: Ritual[] = ritualsRes.data || [];
    const history: DailyHistory[] = historyRes.data || [];

    console.log(`📊 Loaded: ${tasks.length} tasks, ${events.length} events, ${rituals.length} rituals`);

    const blocks: Block[] = [];
    const addBlock = (title: string, start: number, end: number, type: string, extras: Partial<Block> = {}) => {
      if (end > start) {
        blocks.push({
          title,
          start_at: minutesToIso(planningDate, start),
          end_at: minutesToIso(planningDate, end),
          type,
          status: 'planned',
          user_id: userId,
          ...extras,
        });
      }
    };

    // === FIXED SCHEDULE SKELETON ===
    
    // Morning routine (06:00-08:00)
    addBlock('30 push-ups', 360, 362, 'ritual');
    addBlock('Brush teeth', 362, 364, 'ritual');
    addBlock('Get dressed', 364, 366, 'ritual');
    addBlock('Weigh self', 366, 368, 'ritual');
    
    // Build mode (06:10-07:00)
    addBlock('Build mode - Deep work', 370, 420, 'task', { description: 'Morning deep work session' });
    
    // Run + Shower (07:00-07:40)
    const runStart = isWeekend ? 450 : 420; // 07:30 weekend, 07:00 weekday
    addBlock('Run', runStart, runStart + 30, 'ritual');
    addBlock('Shower', runStart + 30, runStart + 40, 'ritual');
    
    // Prep/Pack (07:40-08:00)
    if (!isWeekend) {
      addBlock('Prep & Pack', 460, 480, 'ritual');
      addBlock('Commute to office', 480, 510, 'commute');
    }
    
    // === HARD-FIXED EVENTS ===
    for (const event of events) {
      const evStart = new Date(event.start_at);
      const evEnd = new Date(event.end_at);
      const startMin = evStart.getHours() * 60 + evStart.getMinutes();
      const endMin = evEnd.getHours() * 60 + evEnd.getMinutes();
      
      addBlock(event.title, startMin, endMin, 'event', { description: 'Calendar event' });
    }
    
    // Fixed meetings based on day
    if (dayOfWeek === 1) { // Monday
      addBlock('Team Meeting', 780, 840, 'event'); // 13:00-14:00
    }
    if (dayOfWeek === 2) { // Tuesday
      addBlock('Agency Meeting', 510, 540, 'event'); // 08:30-09:00
    }
    if (isFriday) {
      addBlock('PS:News Meeting', 510, 540, 'event'); // 08:30-09:00
    }
    
    // === LUNCH (12:00-12:45) ===
    const lunchTitle = lunchMeal && lunchMeal !== 'auto' 
      ? `Lunch: ${lunchMeal}` 
      : 'Lunch';
    addBlock(lunchTitle, 720, 765, 'meal', { meal_details: lunchMeal || undefined });
    
    // === WORK BLOCKS (08:30-16:00 weekdays) ===
    if (!isWeekend) {
      // Filter biz tasks for work hours
      const bizTasks = tasks.filter(t => t.biz_or_personal === 'biz');
      let workStart = 540; // 09:00 (after potential meetings)
      const workEnd = 720; // 12:00 (before lunch)
      const afternoonStart = 765; // 12:45 (after lunch)
      const afternoonEnd = 945; // 15:45
      
      // Morning work session
      for (const task of bizTasks) {
        const duration = task.est_min || task.min_block_min || 30;
        if (workStart + duration <= workEnd && !hasConflict(blocks, workStart, workStart + duration, planningDate)) {
          addBlock(task.title, workStart, workStart + duration, 'task', { task_id: task.id, description: task.description });
          workStart += duration + 5; // 5 min gap
        }
      }
      
      // Afternoon work session
      let currentAfternoon = afternoonStart;
      for (const task of bizTasks) {
        const duration = task.est_min || task.min_block_min || 30;
        if (currentAfternoon + duration <= afternoonEnd && !hasConflict(blocks, currentAfternoon, currentAfternoon + duration, planningDate)) {
          addBlock(task.title, currentAfternoon, currentAfternoon + duration, 'task', { task_id: task.id, description: task.description });
          currentAfternoon += duration + 5;
        }
      }
      
      // Plans for tomorrow (15:45-16:00)
      addBlock('Plans for tomorrow', 945, 960, 'ritual');
      
      // Commute home (16:00-16:30)
      addBlock('Commute home', 960, 990, 'commute');
    } else {
      // Weekend: schedule personal tasks throughout the day
      const personalTasks = tasks.filter(t => t.biz_or_personal === 'personal');
      let currentTime = 510; // 08:30
      
      for (const task of personalTasks) {
        const duration = task.est_min || task.min_block_min || 30;
        // Skip lunch time
        if (currentTime >= 720 && currentTime < 765) currentTime = 765;
        
        if (currentTime + duration <= 1020 && !hasConflict(blocks, currentTime, currentTime + duration, planningDate)) {
          addBlock(task.title, currentTime, currentTime + duration, 'task', { task_id: task.id, description: task.description });
          currentTime += duration + 10;
        }
      }
    }
    
    // === GYM (17:00-18:30) ===
    const workout = workoutType && workoutType !== 'auto' && workoutType !== 'Skip'
      ? workoutType
      : getNextWorkout(history);
    
    if (workoutType !== 'Skip') {
      addBlock(`Gym: ${workout}`, 1020, 1110, 'ritual', { 
        workout_details: { type: workout },
        description: `${workout} workout session`
      });
    }
    
    // === DINNER (18:30-19:15) ===
    const dinnerTitle = dinnerMeal && dinnerMeal !== 'auto'
      ? `Dinner: ${dinnerMeal}`
      : 'Dinner';
    addBlock(dinnerTitle, 1110, 1155, 'meal', { 
      meal_details: dinnerMeal || undefined,
      description: 'Omega-3, Vitamin D3' + (workoutType !== 'Skip' ? ', Creatine' : '')
    });
    
    // === EVENING ROUTINE ===
    addBlock('Walk', 1175, 1200, 'ritual'); // 19:35-20:00
    addBlock('Evening reading/work', 1200, 1260, 'buffer'); // 20:00-21:00
    addBlock('Free time', 1260, 1280, 'buffer'); // 21:00-21:20
    addBlock('Spinal rotation exercises', 1280, 1290, 'ritual'); // 21:20-21:30
    addBlock('Yoga', 1290, 1300, 'ritual'); // 21:30-21:40
    addBlock('Meditation', 1300, 1310, 'ritual'); // 21:40-21:50
    addBlock('Brush teeth', 1310, 1313, 'ritual'); // 21:50-21:53
    addBlock('Wind down', 1313, 1320, 'buffer'); // 21:53-22:00
    addBlock('Sleep', 1320, 1680, 'sleep'); // 22:00-04:00 (next day shown as 28:00)

    // Sort blocks by start time
    blocks.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    console.log(`📦 Generated ${blocks.length} blocks`);

    // Delete existing blocks for the day
    const { error: deleteError } = await supabase
      .from('blocks')
      .delete()
      .gte('start_at', `${dateStr}T00:00:00`)
      .lt('start_at', `${dateStr}T23:59:59`);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw deleteError;
    }

    // Insert new blocks
    const { error: insertError } = await supabase
      .from('blocks')
      .insert(blocks);

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log('✅ Successfully created blocks');

    return new Response(
      JSON.stringify({ 
        success: true, 
        blocksCreated: blocks.length,
        workout,
        lunchMeal: lunchMeal || 'auto',
        dinnerMeal: dinnerMeal || 'auto'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in plan-my-day-code:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
