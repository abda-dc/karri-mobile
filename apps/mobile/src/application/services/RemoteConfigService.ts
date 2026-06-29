import {
  defaultAppConfig,
  type AppConfig,
} from "../../domain/configuration/AppConfig";

export interface RemoteConfigProvider {
  load(): Promise<AppConfig | null>;
}

export class RemoteConfigService {
  private currentConfig: AppConfig;

  constructor(
    private readonly provider: RemoteConfigProvider | null = null,
    defaults: AppConfig = defaultAppConfig,
  ) {
    this.currentConfig = defaults;
  }

  getCurrent(): AppConfig {
    return this.currentConfig;
  }

  async refresh(): Promise<AppConfig> {
    if (!this.provider) {
      return this.currentConfig;
    }

    const loaded = await this.provider.load();

    if (loaded?.schemaVersion === 1) {
      this.currentConfig = loaded;
    }

    return this.currentConfig;
  }
}
