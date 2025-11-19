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
    const { title, description, context, dueAt } = await req.json();
    
    console.log('Decomposing task:', { title, description, context, dueAt });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are a strategic task planner for the AI era. The user works with advanced AI coding assistants (like Claude, GPT) that can implement most technical work through prompts.

Your job: Break tasks into HIGH-LEVEL strategic phases, not granular implementation steps. Focus on:
- What needs to be decided/designed (AI can't decide for you)
- What needs to be tested/validated (AI can't know if it works)
- Integration points and dependencies
- Risk areas that need human oversight

CONTEXT: Modern development workflow
- AI handles: coding, refactoring, documentation, boilerplate
- Human handles: decisions, architecture, testing, integration validation
- Time estimates: include prompt engineering, review, testing - NOT line-by-line coding

Keep it CONCISE. 3-5 strategic steps max. Each step should be a meaningful milestone, not a code task.

Format: Valid JSON only, no markdown.`;

    const userPrompt = `Task: ${title}
${description ? `\nDetails: ${description}` : ''}
${context ? `\nProject: ${context}` : ''}
${dueAt ? `\nDue: ${dueAt}` : ''}

Break this into strategic phases. Return JSON:
{
  "steps": [
    {"title": "Phase name", "description": "What to validate/decide", "estimatedMinutes": 45}
  ],
  "artifacts": ["Key deliverable 1", "Key deliverable 2"],
  "risks": ["Critical risk only"],
  "mvpPath": "One sentence: fastest path to validate this works",
  "totalEstimatedMinutes": 120,
  "minBlockMinutes": 45
}

Keep artifacts to 2-3 items max. Focus on HIGH-LEVEL milestones, not implementation details.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let decomposition;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      decomposition = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI response as JSON');
    }

    console.log('Task decomposed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        decomposition 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in decompose-task function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
