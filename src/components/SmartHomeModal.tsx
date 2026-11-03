import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Check, 
  Copy, 
  Server, 
  Wifi, 
  ExternalLink, 
  Terminal, 
  Radio, 
  Cpu, 
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  SmartHomeSettings, 
  sendWebhook, 
  generateHomeAssistantYaml,
  PVWebhookPayload 
} from '../lib/homeAssistant';

interface SmartHomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  settings: SmartHomeSettings;
  onSaveSettings: (settings: SmartHomeSettings) => void;
  currentMetricsPayload: any;
}

export const SmartHomeModal: React.FC<SmartHomeModalProps> = ({
  isOpen,
  onClose,
  theme,
  settings,
  onSaveSettings,
  currentMetricsPayload
}) => {
  const isDark = theme === 'dark';
  const [localSettings, setLocalSettings] = useState<SmartHomeSettings>(settings);
  const [activeTab, setActiveTab] = useState<'webhook' | 'rest_api' | 'mqtt'>('webhook');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; statusCode?: number } | null>(null);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  const handleTestWebhook = async () => {
    if (!localSettings.webhookUrl) {
      setTestResult({ success: false, message: 'Wprowadź najpierw adres URL webhooka.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);

    const testPayload: PVWebhookPayload = {
      event: 'test_ping',
      timestamp: new Date().toISOString(),
      installation: {
        name: localSettings.installationName,
        peakPowerKwp: localSettings.peakPowerKwp,
        billingType: 'Net-metering 0.8',
      },
      metrics: {
        year: currentMetricsPayload?.year || new Date().getFullYear(),
        month: currentMetricsPayload?.month || new Date().getMonth() + 1,
        monthName: currentMetricsPayload?.monthName || 'Bieżący',
        production_kwh: currentMetricsPayload?.production || 0,
        import_kwh: currentMetricsPayload?.importFromGrid || 0,
        export_kwh: currentMetricsPayload?.exportToGrid || 0,
        self_consumption_kwh: currentMetricsPayload?.selfConsumptionKw || 0,
        self_consumption_percent: currentMetricsPayload?.selfConsumptionPercent || 0,
        coverage_percent: currentMetricsPayload?.coveragePercent || 0,
        corrected_grid_energy_08_kwh: currentMetricsPayload?.correctedGridEnergy || 0,
        grid_balance_kwh: currentMetricsPayload?.gridBalance || 0,
        financial_balance_pln: currentMetricsPayload?.financialBalance || 0,
        energy_price_pln: currentMetricsPayload?.pricePerKwh || 0.95,
      },
    };

    const res = await sendWebhook(localSettings.webhookUrl, testPayload);
    setIsTesting(false);
    setTestResult(res);
  };

  const haYaml = generateHomeAssistantYaml();

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(haYaml);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  const handleCopyEndpoint = () => {
    const fullUrl = `${window.location.origin}/api/v1/metrics/latest`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className={cn(
        "w-full max-w-3xl rounded-[36px] border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-300",
        isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
      )}>
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-md">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                INTEGRACJA SMART HOME & IOT
              </div>
              <h2 className="text-lg font-black tracking-tight">
                Home Assistant, Webhooki & REST API
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 gap-2 pt-2 bg-slate-50/50 dark:bg-slate-950/50">
          <button
            onClick={() => setActiveTab('webhook')}
            className={cn(
              "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
              activeTab === 'webhook'
                ? "border-emerald-500 text-emerald-500"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            <Send className="w-3.5 h-3.5" />
            Webhooki & Powiadomienia
          </button>
          <button
            onClick={() => setActiveTab('rest_api')}
            className={cn(
              "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
              activeTab === 'rest_api'
                ? "border-emerald-500 text-emerald-500"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            <Server className="w-3.5 h-3.5" />
            Home Assistant REST Sensor
          </button>
          <button
            onClick={() => setActiveTab('mqtt')}
            className={cn(
              "px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
              activeTab === 'mqtt'
                ? "border-emerald-500 text-emerald-500"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            <Radio className="w-3.5 h-3.5" />
            MQTT & Node-RED
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {activeTab === 'webhook' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                <p>
                  Podaj adres URL webhooka w swoim systemie (np. Home Assistant Automation Webhook Trigger, Node-RED, n8n lub Zapier). Aplikacja może automatycznie wysyłać odczyty przy każdym zapisie.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Adres URL Webhooka (POST)
                  </label>
                  <input
                    type="url"
                    placeholder="https://twoj-home-assistant.duckdns.org/api/webhook/pv_metrics_sync"
                    value={localSettings.webhookUrl}
                    onChange={(e) => setLocalSettings({ ...localSettings, webhookUrl: e.target.value })}
                    className={cn(
                      "w-full px-4 py-3 rounded-2xl border font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
                      isDark ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                  <div>
                    <div className="text-xs font-bold">Automatyczna wysyłka przy zapisie</div>
                    <div className="text-[10px] text-slate-400">Wyślij dane do webhooka natychmiast po naciśnięciu "Zapisz Odczyt"</div>
                  </div>
                  <button
                    onClick={() => setLocalSettings({ ...localSettings, autoSendOnSave: !localSettings.autoSendOnSave })}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      localSettings.autoSendOnSave ? "bg-emerald-500" : (isDark ? "bg-slate-800" : "bg-slate-200")
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        localSettings.autoSendOnSave ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>

                {/* Test button & status */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={handleTestWebhook}
                    disabled={isTesting || !localSettings.webhookUrl}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Send className="w-4 h-4" />}
                    Wyślij testowy webhook
                  </button>

                  {testResult && (
                    <div className={cn(
                      "w-full sm:w-auto flex-1 p-3 rounded-xl border text-xs font-medium flex items-center gap-2",
                      testResult.success 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
                        : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                    )}>
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                      <span>{testResult.message} {testResult.statusCode ? `(Kod HTTP ${testResult.statusCode})` : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payload structure preview */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Przykładowy wysyłany payload JSON:
                </span>
                <pre className={cn(
                  "p-4 rounded-2xl border font-mono text-[11px] overflow-x-auto leading-relaxed",
                  isDark ? "bg-slate-950 border-slate-800 text-emerald-400" : "bg-slate-50 border-slate-200 text-emerald-700"
                )}>
{`{
  "event": "pv_reading_saved",
  "installation": { "name": "${localSettings.installationName}", "peakPowerKwp": ${localSettings.peakPowerKwp} },
  "metrics": {
    "year": 2026,
    "month": 10,
    "production_kwh": 340.5,
    "import_kwh": 180.2,
    "export_kwh": 210.0,
    "self_consumption_kwh": 130.5,
    "self_consumption_percent": 38.3,
    "coverage_percent": 42.0,
    "grid_balance_kwh": -12.0,
    "financial_balance_pln": 245.80
  }
}`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'rest_api' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Publiczny REST API Endpoint dla Home Assistanta
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex-1 px-4 py-3 rounded-2xl border font-mono text-xs font-bold flex items-center justify-between",
                    isDark ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                  )}>
                    <span className="truncate">{window.location.origin}/api/v1/metrics/latest</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 text-[10px]">GET</span>
                  </div>
                  <button
                    onClick={handleCopyEndpoint}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Kopiuj URL"
                  >
                    {copiedEndpoint ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Ready YAML Code */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-blue-500" />
                    Wklej do swojego pliku sensor.yaml w Home Assistant:
                  </span>
                  <button
                    onClick={handleCopyYaml}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 transition-colors"
                  >
                    {copiedYaml ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedYaml ? 'Skopiowano!' : 'Kopiuj YAML'}</span>
                  </button>
                </div>

                <pre className={cn(
                  "p-4 rounded-2xl border font-mono text-[11px] overflow-x-auto max-h-[300px] leading-relaxed",
                  isDark ? "bg-slate-950 border-slate-800 text-blue-300" : "bg-slate-50 border-slate-200 text-blue-900"
                )}>
                  {haYaml}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'mqtt' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
                <Radio className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                <p>
                  Mostek MQTT: Możesz zintegrować aplikację z brokerem Mosquitto w prosty sposób za pomocą Node-RED lub automatyzacji Home Assistant nasłuchującej na webhooku.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Topiki MQTT (Standard Home Assistant Discovery):
                </h4>
                <div className="grid grid-cols-1 gap-2 font-mono text-xs">
                  <div className={cn("p-3 rounded-xl border flex justify-between", isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <span className="text-slate-400">homeassistant/sensor/pv_monitor/production</span>
                    <span className="text-emerald-500 font-bold">kWh</span>
                  </div>
                  <div className={cn("p-3 rounded-xl border flex justify-between", isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <span className="text-slate-400">homeassistant/sensor/pv_monitor/self_consumption</span>
                    <span className="text-emerald-500 font-bold">%</span>
                  </div>
                  <div className={cn("p-3 rounded-xl border flex justify-between", isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <span className="text-slate-400">homeassistant/sensor/pv_monitor/balance</span>
                    <span className="text-emerald-500 font-bold">PLN</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/30 dark:bg-slate-950/30">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all"
          >
            Zapisz Ustawienia
          </button>
        </div>
      </div>
    </div>
  );
};
