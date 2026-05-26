import SetupWizard from './SetupWizard';
import type { AppConfig } from '@/types';

interface Props {
  appConfig: AppConfig;
  onOpenDeepLink: (url: string) => void;
  isTelegramWebApp: boolean;
  onGoBack: () => void;
  onOpenQR?: () => void;
  connectionUrl?: string | null;
}

export default function InstallationGuide({
  appConfig,
  onOpenDeepLink,
  isTelegramWebApp,
  onGoBack,
  onOpenQR,
  connectionUrl,
}: Props) {
  return (
    <SetupWizard
      appConfig={appConfig}
      onOpenDeepLink={onOpenDeepLink}
      isTelegramWebApp={isTelegramWebApp}
      onGoBack={onGoBack}
      onOpenQR={onOpenQR}
      connectionUrl={connectionUrl}
    />
  );
}
