'use client';

import { Plus } from 'lucide-react';
import { Page } from '@/components/Page';
import { PageHead } from '@/components/PageHead';
import { NewCard, ResourceCard } from '@/components/ResourceCard';
import { CardsSkeleton, EmptyState, ErrorState } from '@/components/States';
import { CopyField } from '@/components/CopyField';
import { CodeSample } from '@/components/CodeSample';
import { PremiumModels } from '@/components/PremiumModels';
import { useAiKeys, useCatalog } from '@/lib/api/hooks';
import { modelBadge, modelPrice } from '@/lib/catalog';
import { env } from '@/lib/env';
import { useProject } from '@/lib/project';
import { useNavActions } from '@/lib/nav-actions';

const ENDPOINT = env.aiUrl;

function Ai() {
  const { project } = useProject();
  const { openResource, create } = useNavActions();
  const keys = useAiKeys(project.id);
  const catalog = useCatalog();
  const models = catalog.data?.ai_models ?? [];
  const llm = models.find((m) => m.type === 'llm')?.id ?? '<model>';
  const decision = models.find((m) => m.type === 'decision')?.id ?? '<decision-model>';
  const emb = models.find((m) => m.type === 'embedding')?.id ?? '<embedding-model>';
  const stt = models.find((m) => m.type === 'stt')?.id;
  const tts = models.find((m) => m.type === 'tts')?.id;

  const samples: Record<string, string> = {
    curl: `curl ${ENDPOINT}/chat/completions \\
  -H "Authorization: Bearer $PMS_API_KEY" \\
  -d '{"model": "${llm}",
       "messages": [{"role": "user", "content": "hi"}]}'`,
    python: `from openai import OpenAI

client = OpenAI(base_url="${ENDPOINT}",
                api_key=os.environ["PMS_API_KEY"])
# Embeddings use the same client.
client.embeddings.create(model="${emb}", input="hello")`,
    decision: `curl ${ENDPOINT}/systemone \\
  -H "Authorization: Bearer $PMS_API_KEY" \\
  -d '{"model": "${decision}",
       "state": "A user said hi in the channel.",
       "questions": {"reply": {
         "type": "choice",
         "instructions": "Should the bot answer?",
         "criteria": {"respond": "Answer the message",
                      "ignore": "Do nothing"}}}}'`,
    ...(stt
      ? {
          transcription: `from openai import OpenAI

client = OpenAI(base_url="${ENDPOINT}",
                api_key=os.environ["PMS_API_KEY"])
# Audio must be WAV.
transcript = client.audio.transcriptions.create(
    model="${stt}", file=open("audio.wav", "rb"))
print(transcript.text)`,
        }
      : {}),
    ...(tts
      ? {
          speech: `from openai import OpenAI

client = OpenAI(base_url="${ENDPOINT}",
                api_key=os.environ["PMS_API_KEY"])
# Output is WAV. Ask for it: the default is mp3.
response = client.audio.speech.create(
    model="${tts}", voice="alloy", input="Hello",
    response_format="wav")
response.write_to_file("speech.wav")`,
        }
      : {}),
  };

  return (
    <>
      <PageHead
        title="AI"
        description="LLM, embedding, decision and speech models behind one OpenAI-compatible endpoint. Each key has its own models and budget."
        action={
          <button className="btn primary" type="button" onClick={() => create('/ai', 'ai')}>
            <Plus aria-hidden="true" />
            Create API key
          </button>
        }
      />
      <section className="endpoint">
        <div>
          <h3>Endpoint</h3>
          <p>Works with any OpenAI SDK. Change the base URL and the key.</p>
          <CopyField value={ENDPOINT} />
        </div>
        <CodeSample samples={samples} />
      </section>

      <div className="section-t">
        <h2>API keys</h2>
      </div>
      {keys.isLoading ? (
        <CardsSkeleton count={2} />
      ) : keys.isError ? (
        <ErrorState error={keys.error} onRetry={() => keys.refetch()} />
      ) : keys.data?.length === 0 ? (
        <EmptyState
          text="No API keys yet. Create a key to call the models."
          action="Create API key"
          onAction={() => create('/ai', 'ai')}
        />
      ) : (
        <div className="cards">
          {keys.data?.map((k) => (
            <ResourceCard
              key={k.id}
              r={{ kind: 'ai', ...k }}
              onOpen={() => openResource('/ai', k.id)}
            />
          ))}
          <NewCard label="Create API key" onClick={() => create('/ai', 'ai')} />
        </div>
      )}

      <div className="section-t">
        <h2>Models</h2>
      </div>
      {catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : catalog.isLoading ? (
        <CardsSkeleton count={3} />
      ) : (
        <div className="models">
          {models.map((m) => {
            const badge = modelBadge(m.type);
            const price = modelPrice(m);
            return (
              <div className="model" key={m.id}>
                <div className="mid">
                  {m.id}
                  <span className={badge.className}>{badge.label}</span>
                </div>
                <p>{m.description}</p>
                <span className="ctx">{[m.detail, price].filter(Boolean).join(' · ')}</span>
              </div>
            );
          })}
        </div>
      )}
      <PremiumModels />
    </>
  );
}

export default function AiPage() {
  return (
    <Page>
      <Ai />
    </Page>
  );
}
