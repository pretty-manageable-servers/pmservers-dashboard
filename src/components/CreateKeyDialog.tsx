'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { useCatalog, useCreateAiKey } from '@/lib/api/hooks';
import { useProject } from '@/lib/project';
import { validateName } from '@/lib/validation';

const BADGE = {
  llm: ['llm', 'LLM'],
  embedding: ['emb', 'Embedding'],
  decision: ['dec', 'Decision'],
} as const;

export function CreateKeyDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (secret: string) => void;
}) {
  const { project } = useProject();
  const catalog = useCatalog();
  const create = useCreateAiKey(project.id);
  const [name, setName] = useState('');
  const [models, setModels] = useState<string[]>(['embeddinggemma-2', 'kev-4b']);
  const [budget, setBudget] = useState('1');
  const [touched, setTouched] = useState(false);

  const nameErr = validateName(name);
  const budgetNum = Number(budget);
  const budgetErr = !(budgetNum >= 0) || budget === '' ? 'Enter a budget of 0 or more.' : null;
  const modelErr = models.length === 0 ? 'Pick at least one model.' : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameErr || budgetErr || modelErr) return;
    create.mutate(
      { name, models, budget_usd: budgetNum },
      {
        onSuccess: (k) => {
          props.onOpenChange(false);
          props.onCreated(k.secret);
        },
      },
    );
  };

  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Create API key"
      description="You see the key only once. Keep it safe."
    >
      <form id="key-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="k-name">Name</label>
          <input
            id="k-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="rag-indexer"
            autoComplete="off"
            aria-invalid={touched && !!nameErr}
          />
          {touched && nameErr && <span className="err-t">{nameErr}</span>}
        </div>
        <div className="field">
          <span className="fl">Models</span>
          <div className="mlist">
            {catalog.data?.ai_models.map((m) => (
              <label key={m.id}>
                <input
                  type="checkbox"
                  checked={models.includes(m.id)}
                  onChange={(e) =>
                    setModels((cur) =>
                      e.target.checked ? [...cur, m.id] : cur.filter((x) => x !== m.id),
                    )
                  }
                />
                <span className="mono">{m.id}</span>
                <span className={`badge ${BADGE[m.type][0]}`}>{BADGE[m.type][1]}</span>
              </label>
            ))}
          </div>
          {touched && modelErr && <span className="err-t">{modelErr}</span>}
        </div>
        <div className="field">
          <label htmlFor="k-b">Monthly budget</label>
          <div className="prefix">
            <input
              id="k-b"
              type="number"
              step="0.5"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <span>USD</span>
          </div>
          {touched && budgetErr && <span className="err-t">{budgetErr}</span>}
        </div>
      </form>
      <footer>
        <span className="cost">Counts against project limits</span>
        <button className="btn" type="button" onClick={() => props.onOpenChange(false)}>
          Cancel
        </button>
        <button className="btn primary" form="key-form" type="submit" disabled={create.isPending}>
          Create key
        </button>
      </footer>
    </Modal>
  );
}
