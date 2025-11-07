import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feedback, currentBlocks = [], conversationHistory = [] } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const conversationContext = conversationHistory
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You are ChronoPilot's weekly plan assistant helping users refine their gym sessions and meal plans.

CURRENT WEEK PLAN (${currentBlocks.length} blocks - GYM sessions and MEALS only):
${JSON.stringify(currentBlocks, null, 2)}

CONVERSATION HISTORY:
${conversationContext}

USER FEEDBACK:
${feedback}

TASK: Modify the weekly plan based on the user's feedback. Return a JSON object with:
1. "modifiedBlocks": array of updated blocks (complete array with all blocks)
2. "explanation": brief text explaining what changes were made

CONTEXT:
- This is a WEEKLY plan containing only GYM sessions and MEALS
- GYM sessions should follow PPL-Active-PPL split pattern
- Meals include lunch (base + main) and dinner (simple rotation)

RULES FOR MODIFICATIONS:
- When adjusting gym times, maintain 5-min commute buffers (can be implicit in start/end times)
- For meal changes, avoid repeating the same dish 3 days in a row
- For exercise modifications, consider progressive overload (weights should increase appropriately)
- When swapping days, maintain the split pattern (Push → Pull → Legs → Active cycle)
- Keep meal times reasonable: lunch around 12:00-13:00, dinner around 18:30-20:00
- If changing exercises, provide updated target weights based on the exercise type
- Preserve all block metadata (id, user_id, type, status, created_at, updated_at, etc.)

COMMON USER REQUESTS:
- Time adjustments: "Move Monday gym to 18:00"
- Exercise swaps: "Replace bench press with dumbbells"
- Meal changes: "I don't want salmon, use chicken instead"
- Intensity adjustments: "Make Friday's workout lighter"
- Day swaps: "Swap Tuesday and Wednesday workouts"

OUTPUT FORMAT (JSON only):
{
  "modifiedBlocks": [...complete array of all blocks with modifications...],
  "explanation": "I moved Monday's gym session from 17:00 to 18:00 and adjusted the dinner time to 19:00 to accommodate the change."
}`;

    console.log('Calling Lovable AI for week plan refinement...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: feedback }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`Lovable AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    console.log('Successfully refined week plan');

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in refine-week-plan:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
