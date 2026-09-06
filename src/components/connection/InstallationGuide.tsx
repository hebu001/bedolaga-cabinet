import SetupWizard from './SetupWizard';
import type { AppConfig } from '@/types';

interface Props {
  appConfig: AppConfig;
  onOpenDeepLink: (url: string) => void;
  isTelegramWebApp: boolean;
  onGoBack: () => void;
  displayUrl?: string | null;
  hideLink?: boolean;
  connectionUrl?: string | null;
}

export default function InstallationGuide({
  appConfig,
  onOpenDeepLink,
  isTelegramWebApp,
  onGoBack,
  displayUrl,
  hideLink,
  connectionUrl,
}: Props) {
  return (
    <SetupWizard
      appConfig={appConfig}
      onOpenDeepLink={onOpenDeepLink}
      isTelegramWebApp={isTelegramWebApp}
      onGoBack={onGoBack}
      displayUrl={displayUrl}
      hideLink={hideLink}
      connectionUrl={connectionUrl}
    />
  );
}
