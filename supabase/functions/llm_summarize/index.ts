import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LLMRequest {
  parcel: {
    apn: string
    address: string | null
    lotArea: number
    rearFreeSqft: number
    hasPool: boolean
    zoningCode: string | null
    approximate: boolean
  }
  filters: {
    minRearSqft: number
    hasPool?: boolean
  }
  prompt: string
  provider?: 'openai' | 'anthropic'
  userId?: string
}

interface LLMResponse {
  qualifies: boolean
  rationale: string
  provider: string
  model: string
  tokensUsed: number
  cost: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { parcel, filters, prompt, provider = 'openai', userId } = await req.json() as LLMRequest

    // Get environment variables
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    const anthropicEnabled = Deno.env.get('LLM_ANTHROPIC_ENABLED') === 'true'

    // Determine which provider to use
    let selectedProvider = provider
    if (provider === 'anthropic' && (!anthropicEnabled || !anthropicApiKey)) {
      selectedProvider = 'openai'
    }
    if (selectedProvider === 'openai' && !openaiApiKey) {
      throw new Error('No LLM provider available')
    }

    let response: LLMResponse

    if (selectedProvider === 'openai') {
      response = await callOpenAI(prompt, openaiApiKey!)
    } else {
      response = await callAnthropic(prompt, anthropicApiKey!)
    }

    // Log usage to Supabase
    if (userId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      await supabase.from('api_usage').insert({
        user_id: userId,
        search_id: 'llm_analysis',
        provider: response.provider,
        model: response.model,
        tokens_used: response.tokensUsed,
        cost: response.cost,
      })
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('LLM analysis error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'LLM analysis failed', 
        message: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

async function callOpenAI(prompt: string, apiKey: string): Promise<LLMResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a real estate analysis assistant. Analyze parcels for rear yard qualification based on the provided criteria. Respond with a JSON object containing "qualifies" (boolean) and "rationale" (string, max 100 characters).'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content
  const tokensUsed = data.usage.total_tokens
  
  // Parse the JSON response
  let parsedResponse
  try {
    parsedResponse = JSON.parse(content)
  } catch {
    // Fallback if JSON parsing fails
    parsedResponse = {
      qualifies: false,
      rationale: 'Analysis inconclusive'
    }
  }

  // Calculate cost (GPT-4o-mini pricing: ~$0.15 per 1M tokens)
  const cost = (tokensUsed / 1000000) * 0.15

  return {
    qualifies: parsedResponse.qualifies || false,
    rationale: parsedResponse.rationale || 'Analysis completed',
    provider: 'openai',
    model: 'gpt-4o-mini',
    tokensUsed,
    cost,
  }
}

async function callAnthropic(prompt: string, apiKey: string): Promise<LLMResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 150,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nRespond with a JSON object containing "qualifies" (boolean) and "rationale" (string, max 100 characters).`
        }
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.content[0].text
  const tokensUsed = data.usage.input_tokens + data.usage.output_tokens

  // Parse the JSON response
  let parsedResponse
  try {
    parsedResponse = JSON.parse(content)
  } catch {
    // Fallback if JSON parsing fails
    parsedResponse = {
      qualifies: false,
      rationale: 'Analysis inconclusive'
    }
  }

  // Calculate cost (Claude 3.5 Sonnet pricing: ~$3 per 1M tokens)
  const cost = (tokensUsed / 1000000) * 3.0

  return {
    qualifies: parsedResponse.qualifies || false,
    rationale: parsedResponse.rationale || 'Analysis completed',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    tokensUsed,
    cost,
  }
}