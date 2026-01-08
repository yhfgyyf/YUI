import React, { useState, useEffect } from 'react';
import { X, Download, Upload, Moon, Sun, Database, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ModelSettings, UIPreferences, Model, ExtraParam, ExtraParamType } from '@/types';
import { chatAPI } from '@/services/api';
import { useChatStore } from '@/store';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ModelSettings;
  uiPreferences: UIPreferences;
  onUpdateSettings: (settings: Partial<ModelSettings>) => void;
  onUpdateUIPreferences: (preferences: Partial<UIPreferences>) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onOpenModelSources: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  uiPreferences,
  onUpdateSettings,
  onUpdateUIPreferences,
  onExport,
  onImport,
  onOpenModelSources,
}) => {
  const { modelSources } = useChatStore();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadModels();
    }
  }, [isOpen, modelSources]);

  const loadModels = async () => {
    setLoading(true);
    try {
      // 从 modelSources 中获取所有检测到的模型
      const sourceModels: Model[] = [];
      modelSources.forEach(source => {
        source.models.forEach(model => {
          if (model.available) {
            sourceModels.push({
              id: model.id,
              name: model.name || model.id,
              object: 'model',
              sourceId: source.id,
            });
          }
        });
      });

      // 尝试从 API 获取模型（保持向后兼容）
      try {
        const apiModels = await chatAPI.listModels();
        // 合并模型列表，优先显示来源模型
        const allModels = [...sourceModels];
        apiModels.forEach(apiModel => {
          // 避免重复添加
          if (!allModels.find(m => m.id === apiModel.id)) {
            allModels.push(apiModel);
          }
        });
        setModels(allModels);
      } catch (error) {
        // 如果 API 失败，只使用来源模型
        console.warn('Failed to load models from API, using source models only:', error);
        setModels(sourceModels);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        onImport(file);
      }
    };
    input.click();
  };

  const toggleTheme = () => {
    const newTheme = uiPreferences.theme === 'light' ? 'dark' : 'light';
    onUpdateUIPreferences({ theme: newTheme });
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold">设置</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Model Sources Link */}
          <section>
            <button
              onClick={onOpenModelSources}
              className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors w-full text-left"
            >
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="font-semibold text-blue-900 dark:text-blue-100">模型来源配置</div>
                <div className="text-sm text-blue-600 dark:text-blue-300">管理和检测多个模型源</div>
              </div>
            </button>
          </section>

          {/* Model Settings */}
          <section>
            <h3 className="text-xl font-semibold mb-4">模型配置</h3>

            <div className="space-y-4">
              {/* Model Selection */}
              <div>
                <label className="block text-base font-medium mb-2">模型</label>
                <select
                  value={settings.model}
                  onChange={(e) => onUpdateSettings({ model: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                  disabled={loading}
                >
                  {/* 按模型来源分组显示 */}
                  {modelSources.length > 0 && modelSources.map((source) => {
                    const sourceModelsList = models.filter(m => m.sourceId === source.id);
                    if (sourceModelsList.length === 0) return null;
                    return (
                      <optgroup key={source.id} label={source.name}>
                        {sourceModelsList.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name || model.id}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}

                  {/* 显示没有来源的模型（兼容旧数据） */}
                  {models.filter(m => !m.sourceId).length > 0 && (
                    <optgroup label="其他模型">
                      {models.filter(m => !m.sourceId).map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name || model.id}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-base font-medium mb-2">
                  Temperature: {settings.temperature.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={settings.temperature}
                  onChange={(e) =>
                    onUpdateSettings({ temperature: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>精确</span>
                  <span>创造性</span>
                </div>
              </div>

              {/* Top P */}
              <div>
                <label className="block text-base font-medium mb-2">
                  Top P: {settings.top_p.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.top_p}
                  onChange={(e) => onUpdateSettings({ top_p: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-base font-medium mb-2">Max Tokens</label>
                <input
                  type="number"
                  min="1"
                  max="32000"
                  value={settings.max_tokens || ''}
                  onChange={(e) =>
                    onUpdateSettings({
                      max_tokens: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="自动"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-base font-medium mb-2">系统提示词</label>
                <textarea
                  value={settings.system || ''}
                  onChange={(e) => onUpdateSettings({ system: e.target.value || undefined })}
                  placeholder="你是一个有帮助的助手..."
                  rows={4}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-base"
                />
              </div>

              {/* 额外参数 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-base font-medium">
                    额外参数
                  </label>
                  <button
                    onClick={() => {
                      const newParams = [
                        ...(settings.extraParams || []),
                        {
                          name: 'extra_body',
                          value: '{"chat_template_kwargs": {"enable_thinking": false}}',
                          type: 'json' as ExtraParamType,
                          enabled: true,
                        },
                      ];
                      onUpdateSettings({ extraParams: newParams });
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
                  >
                    <Plus className="w-4 h-4" />
                    添加参数
                  </button>
                </div>

                {/* 参数列表 */}
                <div className="space-y-3">
                  {settings.extraParams?.map((param, index) => (
                    <div
                      key={index}
                      className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800"
                    >
                      <div className="grid grid-cols-12 gap-2 items-start">
                        {/* 启用复选框 */}
                        <div className="col-span-1 flex items-center pt-2">
                          <input
                            type="checkbox"
                            checked={param.enabled}
                            onChange={(e) => {
                              const newParams = [...(settings.extraParams || [])];
                              newParams[index] = { ...param, enabled: e.target.checked };
                              onUpdateSettings({ extraParams: newParams });
                            }}
                            className="w-4 h-4"
                          />
                        </div>

                        {/* 参数名 */}
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={param.name}
                            onChange={(e) => {
                              const newParams = [...(settings.extraParams || [])];
                              newParams[index] = { ...param, name: e.target.value };
                              onUpdateSettings({ extraParams: newParams });
                            }}
                            placeholder="参数名"
                            className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* 参数类型 */}
                        <div className="col-span-2">
                          <select
                            value={param.type}
                            onChange={(e) => {
                              const newParams = [...(settings.extraParams || [])];
                              newParams[index] = { ...param, type: e.target.value as ExtraParamType };
                              onUpdateSettings({ extraParams: newParams });
                            }}
                            className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="text">文本</option>
                            <option value="json">JSON</option>
                            <option value="bool">布尔</option>
                            <option value="number">数字</option>
                          </select>
                        </div>

                        {/* 参数值 */}
                        <div className="col-span-5">
                          <input
                            type="text"
                            value={param.value}
                            onChange={(e) => {
                              const newParams = [...(settings.extraParams || [])];
                              newParams[index] = { ...param, value: e.target.value };
                              onUpdateSettings({ extraParams: newParams });
                            }}
                            placeholder="参数值"
                            className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* 删除按钮 */}
                        <div className="col-span-1 flex items-center">
                          <button
                            onClick={() => {
                              const newParams = settings.extraParams?.filter((_, i) => i !== index);
                              onUpdateSettings({ extraParams: newParams });
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!settings.extraParams || settings.extraParams.length === 0) && (
                    <div className="text-sm text-gray-500 text-center py-2">
                      暂无额外参数，点击"添加参数"按钮创建
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* UI Preferences */}
          <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-xl font-semibold mb-4">界面偏好</h3>

            <div className="space-y-4">
              {/* Theme */}
              <div>
                <label className="block text-base font-medium mb-2">主题</label>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-base"
                >
                  {uiPreferences.theme === 'light' ? (
                    <>
                      <Sun className="w-4 h-4" />
                      <span>亮色</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4" />
                      <span>暗色</span>
                    </>
                  )}
                </button>
              </div>

              {/* Font Size */}
              <div>
                <label className="block text-base font-medium mb-2">字体大小</label>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => onUpdateUIPreferences({ fontSize: size })}
                      className={clsx(
                        'px-4 py-2 rounded-lg transition-colors text-base',
                        uiPreferences.fontSize === size
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      )}
                    >
                      {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Density */}
              <div>
                <label className="block text-base font-medium mb-2">消息密度</label>
                <div className="flex gap-2">
                  {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                    <button
                      key={density}
                      onClick={() => onUpdateUIPreferences({ messageDensity: density })}
                      className={clsx(
                        'px-4 py-2 rounded-lg transition-colors text-base',
                        uiPreferences.messageDensity === density
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      )}
                    >
                      {density === 'compact' ? '紧凑' : density === 'comfortable' ? '舒适' : '宽松'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Import/Export */}
          <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-xl font-semibold mb-4">数据管理</h3>

            <div className="flex gap-4">
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-base font-medium"
              >
                <Download className="w-4 h-4" />
                <span>导出全部</span>
              </button>
              <button
                onClick={handleImportClick}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-base font-medium"
              >
                <Upload className="w-4 h-4" />
                <span>导入</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
