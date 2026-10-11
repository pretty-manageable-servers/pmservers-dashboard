'use client';

import { Page } from '@/components/Page';
import { PageHead } from '@/components/PageHead';
import { SettingsTabs } from '@/components/SettingsTabs';
import { ApiTokensPanel } from '@/components/ApiTokensPanel';

export default function SettingsTokensPage() {
  return (
    <Page>
      <PageHead
        title="Settings"
        description="Your account comes from your sign-in. Project limits are set by PMS Cloud."
      />
      <SettingsTabs current="tokens" />
      <ApiTokensPanel />
    </Page>
  );
}
