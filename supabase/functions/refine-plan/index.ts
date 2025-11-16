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
    const { feedback, currentBlocks, conversationHistory } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.info('Refining plan based on user feedback');
    console.info(`Current blocks count: ${currentBlocks?.length || 0}`);
    console.info(`User feedback: ${feedback}`);

    const conversationContext = conversationHistory
      ?.map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n') || '';

    const systemPrompt = `You are a day planner assistant helping users refine their schedule.

CURRENT SCHEDULE (${currentBlocks.length} blocks):
${JSON.stringify(currentBlocks, null, 2)}

CONVERSATION HISTORY:
${conversationContext}

USER FEEDBACK:
${feedback}

TASK: Modify the schedule based on the user's feedback. Return a JSON object with:
1. "modifiedBlocks": array of updated time blocks (complete array with all blocks, modified and unmodified)
2. "explanation": brief text explaining what changes were made and why

CRITICAL RULES:
- Respect FIXED blocks (type: "ritual" with hard_fixed=true, sleep, meals)
- When moving a block, shift subsequent blocks accordingly to avoid overlaps
- Maintain realistic durations and transitions
- Keep task priorities intact
- If a change isn't feasible, explain why and suggest alternatives
- Return ALL blocks (not just changed ones) in the modifiedBlocks array
- PRESERVE all block properties: id, user_id, task_id, ritual_id, created_at, updated_at, status
- Only modify start_at, end_at, title, description, or notes if explicitly requested
- CRITICAL: Every block MUST have user_id preserved from the original blocks

OUTPUT FORMAT (JSON only, no markdown):
{
  "modifiedBlocks": [...],
  "explanation": "I moved your lunch from 12:00 to 13:00 and shifted the afternoon tasks accordingly. Your workout remained at 17:00 as requested."
}`;

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
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiContent = aiData.choices[0].message.content;
    
    console.info('AI response received');
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error('Invalid AI response format');
    }

    console.info(`Modified blocks count: ${parsedResponse.modifiedBlocks?.length || 0}`);

    return new Response(
      JSON.stringify(parsedResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in refine-plan:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        modifiedBlocks: [],
        explanation: 'Sorry, I encountered an error processing your request.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
