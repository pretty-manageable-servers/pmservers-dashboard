'use client';

import { Plus } from 'lucide-react';
import { Page } from '@/components/Page';
import { PageHead } from '@/components/PageHead';
import { NewCard, ResourceCard } from '@/components/ResourceCard';
import { CardsSkeleton, EmptyState, ErrorState } from '@/components/States';
import { CopyField } from '@/components/CopyField';
import { CodeSample } from '@/components/CodeSample';
import { useAiKeys, useCatalog } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { useNavActions } from '@/lib/nav-actions';

const ENDPOINT = 'https://api.pmservers.org/ai/v1';
const BADGE = {
  llm: ['llm', 'LLM'],
  embedding: ['emb', 'Embedding'],
  decision: ['dec', 'Decision'],
} as const;

function Ai() {
  const { project } = useProject();
  const { openResource, create } = useNavActions();
  const keys = useAiKeys(project.id);
  const catalog = useCatalog();
  const models = catalog.data?.ai_models ?? [];
  const llm = models.find((m) => m.type === 'llm')?.id ?? 'gemma-4-e4b';
  const emb = models.find((m) => m.type === 'embedding')?.id ?? 'embeddinggemma-2';

  const samples = {
    curl: `curl ${ENDPOINT}/chat/completions \\
  -H "Authorization: Bearer $PMS_API_KEY" \\
  -d '{"model": "${llm}",
       "messages": [{"role": "user", "content": "hi"}]}'`,
    python: `from openai import OpenAI

client = OpenAI(base_url="${ENDPOINT}",
                api_key=os.environ["PMS_API_KEY"])
# Embeddings and decisions use the same client.
client.embeddings.create(model="${emb}", input="hello")`,
  };

  return (
    <>
      <PageHead
        title="AI"
        description="LLM, embedding and decision models behind one OpenAI-compatible endpoint. Each key has its own models and budget."
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
          {models.map((m) => (
            <div className="model" key={m.id}>
              <div className="mid">
                {m.id}
                <span className={`badge ${BADGE[m.type][0]}`}>{BADGE[m.type][1]}</span>
              </div>
              <p>{m.description}</p>
              <span className="ctx">{m.detail}</span>
            </div>
          ))}
        </div>
      )}
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
