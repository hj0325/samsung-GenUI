'use strict';

const https = require('https');
const { ensureServerConfig, getServerConfig } = require('../config');

const NO_CUSTOM_TEMP_MODELS = /^(gpt-5|o1|o3|o4)/i;

function supportsCustomTemp(model) {
  return !NO_CUSTOM_TEMP_MODELS.test(model || '');
}

function requestJson(url, body, timeoutMs = 120000) {
  const { OPENAI_API_KEY } = ensureServerConfig();
  const payload = JSON.stringify(body);
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(new URL(url), options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          try {
            const parsed = JSON.parse(data);
            reject(new Error(parsed.error?.message || `OpenAI ${res.statusCode}`));
          } catch (_) {
            reject(new Error(`OpenAI ${res.statusCode}: ${data.substring(0, 200)}`));
          }
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse OpenAI response: ${error.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('OpenAI request timeout'));
    });
    req.write(payload);
    req.end();
  });
}

async function callOpenAI(systemPrompt, userMessage, temperature = 0.7, modelOverride) {
  const config = ensureServerConfig();
  const model = modelOverride || config.OPENAI_MODEL;
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
  };
  if (supportsCustomTemp(model)) body.temperature = temperature;
  const parsed = await requestJson('https://api.openai.com/v1/chat/completions', body);
  const promptTokens = parsed.usage?.prompt_tokens || 0;
  const cachedTokens = parsed.usage?.prompt_tokens_details?.cached_tokens || 0;
  if (promptTokens >= 500) {
    const pct = promptTokens > 0 ? Math.round((cachedTokens / promptTokens) * 100) : 0;
    console.log(`[openai] ${model}  prompt=${promptTokens}  cached=${cachedTokens} (${pct}%)`);
  }
  return JSON.parse(parsed.choices?.[0]?.message?.content || '{}');
}

function callOpenAIFast(systemPrompt, userMessage, temperature = 0.4) {
  return callOpenAI(systemPrompt, userMessage, temperature, getServerConfig().OPENAI_MODEL_FAST);
}

function callOpenAIExplain(systemPrompt, userMessage, temperature = 0.6) {
  return callOpenAI(systemPrompt, userMessage, temperature, getServerConfig().OPENAI_MODEL_EXPLAIN);
}

function callOpenAICompose(systemPrompt, userMessage, temperature = 0.55) {
  return callOpenAI(systemPrompt, userMessage, temperature, getServerConfig().OPENAI_MODEL_COMPOSE);
}

function callOpenAIContentBag(systemPrompt, userMessage, temperature = 0.5) {
  return callOpenAI(systemPrompt, userMessage, temperature, getServerConfig().OPENAI_MODEL_CONTENT_BAG);
}

async function callOpenAIEmbedding(text) {
  const parsed = await requestJson('https://api.openai.com/v1/embeddings', {
    model: 'text-embedding-3-small',
    input: typeof text === 'string' ? text : String(text || ''),
  }, 15000);
  const vector = parsed.data?.[0]?.embedding;
  if (!Array.isArray(vector)) throw new Error('Embedding response missing data[0].embedding');
  return vector;
}

async function callOpenAIStream(systemPrompt, userMessage, temperature, onDelta) {
  const config = ensureServerConfig();
  const body = JSON.stringify({
    model: config.OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: temperature != null ? temperature : 0.7,
    response_format: { type: 'json_object' },
    stream: true,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(new URL('https://api.openai.com/v1/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        let err = '';
        res.on('data', (chunk) => { err += chunk; });
        res.on('end', () => reject(new Error(`OpenAI ${res.statusCode}: ${err.substring(0, 200)}`)));
        return;
      }
      let buffer = '';
      let fullText = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              try { onDelta(delta, fullText); } catch (_) {}
            }
          } catch (_) {}
        }
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(fullText));
        } catch (error) {
          reject(new Error(`Failed to parse streamed JSON: ${error.message} (text length: ${fullText.length})`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('OpenAI stream timeout'));
    });
    req.write(body);
    req.end();
  });
}

module.exports = {
  callOpenAI,
  callOpenAIFast,
  callOpenAIExplain,
  callOpenAICompose,
  callOpenAIContentBag,
  callOpenAIEmbedding,
  callOpenAIStream,
};
