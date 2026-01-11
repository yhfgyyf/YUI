import React, { useState } from 'react';
import { X, Plus, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ModelSource, DetectedModel, ModelType } from '@/types';
import { useChatStore } from '@/store';

interface ModelSourcesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODEL_TYPE_OPTIONS: { value: ModelType; label: string }[] = [
  { value: 'llm', label: 'LLM' },
  { value: 'embedding', label: 'Embedding' },
  { value: 'reranker', label: 'Reranker' },
  { value: 'multimodal', label: '多模态' },
];

export const ModelSourcesPanel: React.FC<ModelSourcesPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { modelSources, addModelSource, updateModelSource, deleteModelSource } = useChatStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
  });

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({ name: '', baseUrl: '', apiKey: '' });
  };

  const handleSaveNew = () => {
    if (!formData.name.trim() || !formData.baseUrl.trim()) {
      alert('请填写模型提供商和 Base URL');
      return;
    }

    addModelSource({
      name: formData.name,
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey,
    });

    setIsAdding(false);
    setFormData({ name: '', baseUrl: '', apiKey: '' });
  };

  const handleEdit = (source: ModelSource) => {
    setEditingId(source.id);
    setFormData({
      name: source.name,
      baseUrl: source.baseUrl,
      apiKey: source.apiKey,
    });
  };

  const handleSaveEdit = () => {
    if (!editingId || !formData.name.trim() || !formData.baseUrl.trim()) {
      alert('请填写模型提供商和 Base URL');
      return;
    }

    updateModelSource(editingId, {
      name: formData.name,
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey,
    });

    setEditingId(null);
    setFormData({ name: '', baseUrl: '', apiKey: '' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ name: '', baseUrl: '', apiKey: '' });
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个模型来源吗？')) {
      deleteModelSource(id);
    }
  };

  const handleTest = async (source: ModelSource) => {
    setTestingId(source.id);

    try {
      // 移除末尾的斜杠并统一拼接 /models
      const baseUrl = source.baseUrl.replace(/\/+$/, '');
      const endpoint = `${baseUrl}/models`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${source.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const models: DetectedModel[] = data.data?.map((model: any) => ({
        id: model.id,
        name: model.id,
        type: 'llm' as ModelType, // 默认为 LLM
        isReasoning: false,
        available: true,
      })) || [];

      updateModelSource(source.id, { models });
      alert(`检测成功！找到 ${models.length} 个模型`);
    } catch (error: any) {
      alert(`检测失败：${error.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleUpdateModel = (sourceId: string, modelId: string, updates: Partial<DetectedModel>) => {
    const source = modelSources.find(s => s.id === sourceId);
    if (!source) return;

    const updatedModels = source.models.map(m =>
      m.id === modelId ? { ...m, ...updates } : m
    );

    updateModelSource(sourceId, { models: updatedModels });
  };

  const handleDeleteModel = (sourceId: string, modelId: string) => {
    const source = modelSources.find(s => s.id === sourceId);
    if (!source) return;

    const updatedModels = source.models.filter(m => m.id !== modelId);
    updateModelSource(sourceId, { models: updatedModels });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold">模型来源配置</h2>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-base"
            >
              <Plus className="w-4 h-4" />
              <span>添加来源</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 添加表单 */}
          {isAdding && (
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <h3 className="text-lg font-semibold mb-4">新建模型来源</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-base font-medium mb-2">模型提供商</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                    placeholder="例如：本地 vLLM"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium mb-2">Base URL</label>
                  <input
                    type="text"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                    placeholder="http://127.0.0.1:8000/v1"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium mb-2">API Key（可选）</label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                    placeholder="留空表示不需要认证"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNew}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-base"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors text-base"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 模型来源列表 */}
          {modelSources.length === 0 && !isAdding && (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg">暂无模型来源，点击右上角"添加来源"按钮开始配置</p>
            </div>
          )}

          {modelSources.map((source) => (
            <div
              key={source.id}
              className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
            >
              {editingId === source.id ? (
                // 编辑模式
                <div>
                  <h3 className="text-lg font-semibold mb-4">编辑模型来源</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-base font-medium mb-2">模型提供商</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-medium mb-2">Base URL</label>
                      <input
                        type="text"
                        value={formData.baseUrl}
                        onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-base font-medium mb-2">API Key</label>
                      <input
                        type="password"
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-base"
                      >
                        保存
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors text-base"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // 显示模式
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{source.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{source.baseUrl}</p>
                      {source.apiKey && (
                        <p className="text-sm text-gray-500">API Key: ********</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTest(source)}
                        disabled={testingId === source.id}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-base',
                          testingId === source.id
                            ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        )}
                      >
                        {testingId === source.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>检测中...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>检测模型</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(source)}
                        className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-base"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-base"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 检测到的模型列表 */}
                  {source.models.length > 0 && (
                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-base font-semibold mb-3">检测到的模型 ({source.models.length})</h4>
                      <div className="space-y-2">
                        {source.models.map((model) => (
                          <div
                            key={model.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{model.id}</span>
                                {model.available ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <select
                                  value={model.type}
                                  onChange={(e) =>
                                    handleUpdateModel(source.id, model.id, {
                                      type: e.target.value as ModelType,
                                    })
                                  }
                                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                                >
                                  {MODEL_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <label className="flex items-center gap-1 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={model.isReasoning}
                                    onChange={(e) =>
                                      handleUpdateModel(source.id, model.id, {
                                        isReasoning: e.target.checked,
                                      })
                                    }
                                  />
                                  <span>推理模型</span>
                                </label>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteModel(source.id, model.id)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                              title="删除模型"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
