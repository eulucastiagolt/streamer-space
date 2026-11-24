import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  type OverlayConfig,
  createDefaultOverlayConfig,
  validateOverlayConfig,
} from '../types/config.js';

const DEFAULT_CONFIG_FILE = join(process.cwd(), 'data', 'overlay-config.json');

export class ConfigStore {
  private _filePath: string;
  private _config: OverlayConfig;

  constructor(filePath?: string) {
    this._filePath = filePath || DEFAULT_CONFIG_FILE;
    this._config = this.load();
  }

  get filePath(): string {
    return this._filePath;
  }

  getConfig(): OverlayConfig {
    return JSON.parse(JSON.stringify(this._config));
  }

  saveConfig(input: any): { success: boolean; config?: OverlayConfig; error?: string } {
    const validation = validateOverlayConfig(input);
    if (!validation.valid || !validation.config) {
      return {
        success: false,
        error: validation.error || 'Configuração de overlay inválida',
      };
    }

    this._config = validation.config;
    this.persistAtomically(this._config);

    return {
      success: true,
      config: this.getConfig(),
    };
  }

  resetConfig(): OverlayConfig {
    this._config = createDefaultOverlayConfig();
    this.persistAtomically(this._config);
    return this.getConfig();
  }

  private persistAtomically(config: OverlayConfig): void {
    const dir = join(this._filePath, '..');
    mkdirSync(dir, { recursive: true });

    const tmpPath = `${this._filePath}.tmp.${Date.now()}_${randomBytes(4).toString('hex')}`;
    const serialized = JSON.stringify(config, null, 2);

    try {
      writeFileSync(tmpPath, serialized, 'utf-8');
      renameSync(tmpPath, this._filePath);
    } catch (err) {
      console.error(`Falha ao persistir configuração de overlay atomicamente em ${this._filePath}:`, err);
    }
  }

  load(): OverlayConfig {
    if (!existsSync(this._filePath)) {
      const def = createDefaultOverlayConfig();
      this._config = def;
      this.persistAtomically(def);
      return def;
    }

    try {
      const content = readFileSync(this._filePath, 'utf-8');
      const parsed = JSON.parse(content);
      const validation = validateOverlayConfig(parsed);

      if (!validation.valid || !validation.config) {
        console.warn(
          `[ConfigStore] Aviso: Arquivo de configuração corrompido ou inválido em "${this._filePath}" (${validation.error}). Recuperando com padrões com segurança sem deletar o arquivo corrompido.`
        );
        const def = createDefaultOverlayConfig();
        this._config = def;
        return def;
      }

      this._config = validation.config;
      return this._config;
    } catch (err: any) {
      console.warn(
        `[ConfigStore] Aviso: Erro ao carregar/analisar JSON em "${this._filePath}": ${err?.message || err}. Recuperando com configurações padrão com segurança sem deletar o arquivo corrompido.`
      );
      const def = createDefaultOverlayConfig();
      this._config = def;
      return def;
    }
  }
}

export const configStore = new ConfigStore();
