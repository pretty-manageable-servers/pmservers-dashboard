import { PageHead } from './PageHead';

export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHead title={title} />
      <div className="empty">This service is coming soon.</div>
    </>
  );
}
