import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaPlus, FaCog, FaTrash, FaCheck, FaTimes, FaEye, FaEyeSlash } from 'react-icons/fa';
import providerService from '../../services/providerService';
import { 
  addProvider, 
  updateProvider, 
  removeProvider, 
  setActiveProvider,
  setShowSettings,
  loadProviders
} from '../../store/slices/providersSlice';

const AIProviderSettings = () => {
  const dispatch = useDispatch();
  const { providers, activeProviderId, showSettings } = useSelector(state => state.providers);
  
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [testingProvider, setTestingProvider] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [showApiKeys, setShowApiKeys] = useState({});
  
  const [newProvider, setNewProvider] = useState({
    name: '',
    type: 'openai',
    baseUrl: '',
    apiKey: '',
    description: ''
  });

  useEffect(() => {
    // Initialize provider service and load providers
    const initializeProviders = async () => {
      await providerService.initialize();
      const allProviders = providerService.getAllProviders();
      dispatch(loadProviders(allProviders.map(p => p.config)));
    };
    
    initializeProviders();
  }, [dispatch]);

  if (!showSettings) {
    return null;
  }

  const handleAddProvider = async () => {
    try {
      const config = {
        ...newProvider,
        id: `${newProvider.type}-${Date.now()}`,
        enabled: true
      };
      
      // Set default base URL for OpenAI if not provided
      if (config.type === 'openai' && !config.baseUrl) {
        config.baseUrl = 'https://api.openai.com';
      }
      
      const provider = await providerService.addProvider(config);
      dispatch(addProvider(provider.config));
      
      setNewProvider({
        name: '',
        type: 'openai',
        baseUrl: '',
        apiKey: '',
        description: ''
      });
      setIsAddingProvider(false);
    } catch (error) {
      console.error('Failed to add provider:', error);
      alert('Failed to add provider: ' + error.message);
    }
  };

  const handleUpdateProvider = async (id, updates) => {
    try {
      const provider = await providerService.updateProvider(id, updates);
      dispatch(updateProvider({ id, ...updates }));
      setEditingProvider(null);
    } catch (error) {
      console.error('Failed to update provider:', error);
      alert('Failed to update provider: ' + error.message);
    }
  };

  const handleRemoveProvider = async (id) => {
    if (!window.confirm('Are you sure you want to remove this provider?')) {
      return;
    }
    
    try {
      await providerService.removeProvider(id);
      dispatch(removeProvider(id));
    } catch (error) {
      console.error('Failed to remove provider:', error);
      alert('Failed to remove provider: ' + error.message);
    }
  };

  const handleSetActiveProvider = async (id) => {
    try {
      await providerService.setActiveProvider(id);
      dispatch(setActiveProvider(id));
    } catch (error) {
      console.error('Failed to set active provider:', error);
      alert('Failed to set active provider: ' + error.message);
    }
  };

  const handleTestProvider = async (id) => {
    setTestingProvider(id);
    setTestResults(prev => ({ ...prev, [id]: null }));
    
    try {
      const result = await providerService.testProvider(id);
      setTestResults(prev => ({ ...prev, [id]: result }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [id]: { success: false, error: error.message } 
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const toggleApiKeyVisibility = (id) => {
    setShowApiKeys(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const renderProviderForm = (provider = null, isEditing = false) => {
    const formData = provider ? { ...provider } : newProvider;
    const isNew = !provider;
    
    return (
      <div className="bg-smortr-card border border-smortr-border rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-smortr-text mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => isNew 
                ? setNewProvider(prev => ({ ...prev, name: e.target.value }))
                : setEditingProvider(prev => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-3 py-2 bg-smortr-bg border border-smortr-border rounded text-smortr-text focus:outline-none focus:ring-2 focus:ring-smortr-accent"
              placeholder="My Provider"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-smortr-text mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => isNew 
                ? setNewProvider(prev => ({ ...prev, type: e.target.value }))
                : setEditingProvider(prev => ({ ...prev, type: e.target.value }))
              }
              className="w-full px-3 py-2 bg-smortr-bg border border-smortr-border rounded text-smortr-text focus:outline-none focus:ring-2 focus:ring-smortr-accent"
            >
              <option value="openai">OpenAI</option>
              <option value="llamacpp">LlamaCpp</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-smortr-text mb-1">
              Base URL
            </label>
            <input
              type="url"
              value={formData.baseUrl}
              onChange={(e) => isNew 
                ? setNewProvider(prev => ({ ...prev, baseUrl: e.target.value }))
                : setEditingProvider(prev => ({ ...prev, baseUrl: e.target.value }))
              }
              className="w-full px-3 py-2 bg-smortr-bg border border-smortr-border rounded text-smortr-text focus:outline-none focus:ring-2 focus:ring-smortr-accent"
              placeholder={formData.type === 'openai' ? 'https://api.openai.com' : 'http://localhost:8091'}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-smortr-text mb-1">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKeys[formData.id] ? "text" : "password"}
                value={formData.apiKey}
                onChange={(e) => isNew 
                  ? setNewProvider(prev => ({ ...prev, apiKey: e.target.value }))
                  : setEditingProvider(prev => ({ ...prev, apiKey: e.target.value }))
                }
                className="w-full px-3 py-2 pr-10 bg-smortr-bg border border-smortr-border rounded text-smortr-text focus:outline-none focus:ring-2 focus:ring-smortr-accent"
                placeholder={formData.type === 'openai' ? 'sk-...' : 'no-key'}
              />
              <button
                type="button"
                onClick={() => toggleApiKeyVisibility(formData.id)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-smortr-text-secondary hover:text-smortr-text"
              >
                {showApiKeys[formData.id] ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-smortr-text mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => isNew 
                ? setNewProvider(prev => ({ ...prev, description: e.target.value }))
                : setEditingProvider(prev => ({ ...prev, description: e.target.value }))
              }
              className="w-full px-3 py-2 bg-smortr-bg border border-smortr-border rounded text-smortr-text focus:outline-none focus:ring-2 focus:ring-smortr-accent"
              placeholder="Optional description"
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={() => isNew ? setIsAddingProvider(false) : setEditingProvider(null)}
            className="px-4 py-2 text-smortr-text-secondary hover:text-smortr-text"
          >
            Cancel
          </button>
          <button
            onClick={() => isNew ? handleAddProvider() : handleUpdateProvider(provider.id, formData)}
            disabled={!formData.name || !formData.apiKey}
            className="px-4 py-2 bg-smortr-accent text-white rounded hover:bg-smortr-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isNew ? 'Add Provider' : 'Update Provider'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-smortr-bg border border-smortr-border rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-smortr-border">
          <h2 className="text-xl font-semibold text-smortr-text">AI Provider Settings</h2>
          <button
            onClick={() => dispatch(setShowSettings(false))}
            className="text-smortr-text-secondary hover:text-smortr-text"
          >
            <FaTimes size={20} />
          </button>
        </div>
        
        <div className="p-6">
          {/* Add Provider Button */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-smortr-text">Configured Providers</h3>
            <button
              onClick={() => setIsAddingProvider(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-smortr-accent text-white rounded hover:bg-smortr-accent/90"
            >
              <FaPlus />
              <span>Add Provider</span>
            </button>
          </div>
          
          {/* Add Provider Form */}
          {isAddingProvider && renderProviderForm()}
          
          {/* Provider List */}
          <div className="space-y-4">
            {providers.map(provider => (
              <div
                key={provider.id}
                className={`bg-smortr-card border rounded-lg p-4 ${
                  provider.id === activeProviderId 
                    ? 'border-smortr-accent ring-1 ring-smortr-accent' 
                    : 'border-smortr-border'
                }`}
              >
                {editingProvider && editingProvider.id === provider.id ? (
                  renderProviderForm(editingProvider, true)
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            checked={provider.id === activeProviderId}
                            onChange={() => handleSetActiveProvider(provider.id)}
                            className="text-smortr-accent focus:ring-smortr-accent"
                          />
                          <h4 className="font-medium text-smortr-text">{provider.name}</h4>
                        </div>
                        <span className="px-2 py-1 text-xs bg-smortr-hover text-smortr-text-secondary rounded">
                          {provider.type}
                        </span>
                        {provider.id === activeProviderId && (
                          <span className="px-2 py-1 text-xs bg-smortr-accent text-white rounded">
                            Active
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {/* Test Connection */}
                        <button
                          onClick={() => handleTestProvider(provider.id)}
                          disabled={testingProvider === provider.id}
                          className="p-2 text-smortr-text-secondary hover:text-smortr-text disabled:opacity-50"
                          title="Test connection"
                        >
                          {testingProvider === provider.id ? (
                            <div className="w-4 h-4 border-2 border-smortr-accent border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <FaCheck />
                          )}
                        </button>
                        
                        {/* Edit */}
                        <button
                          onClick={() => setEditingProvider({ ...provider })}
                          className="p-2 text-smortr-text-secondary hover:text-smortr-text"
                          title="Edit provider"
                        >
                          <FaCog />
                        </button>
                        
                        {/* Delete */}
                        {provider.id !== 'llamacpp' && (
                          <button
                            onClick={() => handleRemoveProvider(provider.id)}
                            className="p-2 text-red-500 hover:text-red-600"
                            title="Remove provider"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm text-smortr-text-secondary mb-2">
                      <div>URL: {provider.baseUrl}</div>
                      {provider.description && <div>Description: {provider.description}</div>}
                    </div>
                    
                    {/* Test Results */}
                    {testResults[provider.id] && (
                      <div className={`text-sm p-2 rounded ${
                        testResults[provider.id].success 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {testResults[provider.id].success 
                          ? '✅ Connection successful' 
                          : `❌ Connection failed: ${testResults[provider.id].error}`
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {providers.length === 0 && (
            <div className="text-center text-smortr-text-secondary py-8">
              No providers configured. Add your first AI provider to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIProviderSettings; 