import { Logo } from './icons';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="art">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
          <Logo />
          PMS Cloud
        </div>
        <h2>Your cloud, pretty manageable.</h2>
        <div className="term">
          $ pms vm create worker-1 --size pm.small
          <br />
          <b>✓</b> worker-1 running in ca-tor-1 (41s)
          <br />
          $ pms ai keys create --model vane
          <br />
          <b>✓</b> pms_sk_••••••••3f1a
        </div>
      </div>
      <div className="form">{children}</div>
    </div>
  );
}

export const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" />
  </svg>
);
