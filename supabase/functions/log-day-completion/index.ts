import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Single-user mode
    const userId = '00000000-0000-0000-0000-000000000001';

    // Get target date from request body (defaults to yesterday)
    const { date: targetDateStr } = await req.json().catch(() => ({}));
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    if (!targetDateStr) {
      targetDate.setDate(targetDate.getDate() - 1); // Default to yesterday
    }
    const dateStr = targetDate.toISOString().split('T')[0];

    console.log(`Logging completion for date: ${dateStr}`);

    // Fetch all blocks for the target date
    const dayStart = `${dateStr}T00:00:00`;
    const dayEnd = `${dateStr}T23:59:59`;

    const { data: blocks, error: blocksError } = await supabase
      .from('blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('start_at', dayStart)
      .lte('start_at', dayEnd);

    if (blocksError) throw blocksError;

    console.log(`Found ${blocks?.length || 0} blocks for ${dateStr}`);

    if (!blocks || blocks.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No blocks found for this date' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract meal details
    const mealBlocks = blocks.filter(b => b.type === 'meal');
    const lunchBlock = mealBlocks.find(b => {
      const hour = new Date(b.start_at).getHours();
      return hour >= 11 && hour <= 14;
    });
    const dinnerBlock = mealBlocks.find(b => {
      const hour = new Date(b.start_at).getHours();
      return hour >= 17 && hour <= 21;
    });

    // Extract workout details
    const workoutBlocks = blocks.filter(b => 
      b.type === 'ritual' && 
      (b.title.toLowerCase().includes('gym') || 
       b.title.toLowerCase().includes('push') ||
       b.title.toLowerCase().includes('pull') ||
       b.title.toLowerCase().includes('legs') ||
       b.title.toLowerCase().includes('swim') ||
       b.title.toLowerCase().includes('active'))
    );
    const gymBlock = workoutBlocks[0]; // Take first workout block

    // Determine workout type from title
    let workoutType = 'Rest';
    let workoutCompleted = false;
    let workoutExercises = null;

    if (gymBlock) {
      const title = gymBlock.title.toLowerCase();
      if (title.includes('push')) workoutType = 'Push';
      else if (title.includes('pull')) workoutType = 'Pull';
      else if (title.includes('legs')) workoutType = 'Legs';
      else if (title.includes('swim') || title.includes('active')) workoutType = 'Active';
      
      workoutCompleted = gymBlock.status === 'done' || gymBlock.status === 'completed';
      workoutExercises = gymBlock.workout_details;
    }

    // Calculate stats
    const completedBlocks = blocks.filter(b => b.status === 'done' || b.status === 'completed');
    const taskBlocks = completedBlocks.filter(b => b.type === 'task');
    const tasksCompleted = taskBlocks.length;

    // Calculate total work minutes (tasks + deep work blocks)
    const totalWorkMinutes = taskBlocks.reduce((sum, b) => {
      const start = new Date(b.start_at).getTime();
      const end = new Date(b.end_at).getTime();
      const durationMin = (end - start) / (1000 * 60);
      return sum + durationMin;
    }, 0);

    // Fetch WHOOP data for the date
    const { data: whoopData } = await supabase
      .from('whoop_daily')
      .select('*')
      .eq('date', dateStr)
      .single();

    // Calculate sleep hours from sleep block
    const sleepBlock = blocks.find(b => b.type === 'sleep');
    let sleepHours = null;
    if (sleepBlock) {
      const start = new Date(sleepBlock.start_at).getTime();
      const end = new Date(sleepBlock.end_at).getTime();
      sleepHours = (end - start) / (1000 * 60 * 60);
    }

    // Upsert into daily_history
    const historyEntry = {
      user_id: userId,
      date: dateStr,
      lunch_meal: lunchBlock?.meal_details || lunchBlock?.title || null,
      dinner_meal: dinnerBlock?.meal_details || dinnerBlock?.title || null,
      workout_type: workoutType,
      workout_exercises: workoutExercises,
      workout_completed: workoutCompleted,
      recovery_pct: whoopData?.recovery_pct || null,
      hrv_ms: whoopData?.hrv_ms || null,
      sleep_hours: sleepHours,
      tasks_completed: tasksCompleted,
      total_work_minutes: Math.round(totalWorkMinutes),
      notes: null
    };

    const { error: upsertError } = await supabase
      .from('daily_history')
      .upsert(historyEntry, { onConflict: 'date' });

    if (upsertError) throw upsertError;

    console.log('Day completion logged successfully:', historyEntry);

    return new Response(JSON.stringify({ 
      success: true,
      date: dateStr,
      summary: {
        lunch: historyEntry.lunch_meal,
        dinner: historyEntry.dinner_meal,
        workout: `${workoutType} ${workoutCompleted ? '✓' : '✗'}`,
        tasksCompleted,
        totalWorkMinutes: Math.round(totalWorkMinutes)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error logging day completion:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
