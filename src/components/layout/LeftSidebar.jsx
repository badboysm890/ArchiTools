import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaRuler, FaLayerGroup, FaPencilAlt, FaFileExport, FaList, FaFileAlt, FaHistory, FaLink } from 'react-icons/fa';
import { BiAbacus } from 'react-icons/bi';
import { setActiveTool, clearActiveTool, updateToolSettings } from '../../store/slices/toolsSlice';

const tools = [
  { id: 'count', name: 'Count', icon: BiAbacus, description: 'Count elements in drawings' },
  { id: 'measure', name: 'Measure', icon: FaRuler, description: 'Measure distances and areas' },
  { id: 'compare', name: 'Compare', icon: FaLayerGroup, description: 'Compare different versions' },
  { id: 'markups', name: 'Markups', icon: FaPencilAlt, description: 'Add annotations and markups' },
  { id: 'extract', name: 'Extract', icon: FaFileExport, description: 'Extract data from drawings' },
  { id: 'list-drawings', name: 'List Drawings', icon: FaList, description: 'View all drawings' },
  { id: 'summarize', name: 'Summarize', icon: FaFileAlt, description: 'Get drawing summaries' },
  { id: 'changelog', name: 'Change Logs', icon: FaHistory, description: 'View change history' },
  { id: 'hyperlinks', name: 'Hyperlinks', icon: FaLink, description: 'Manage drawing links' },
];

const LeftSidebar = () => {
  const dispatch = useDispatch();
  const { activeTool, toolSettings } = useSelector(state => state.tools);

  const handleToolClick = (toolId) => {
    if (activeTool === toolId) {
      dispatch(clearActiveTool());
    } else {
      dispatch(setActiveTool(toolId));
    }
  };

  const renderToolSettings = () => {
    if (!activeTool) {
      return (
        <div className="p-2 bg-smortr-hover rounded">
          <p className="text-sm text-smortr-text-secondary">
            Select a tool to view its settings
          </p>
        </div>
      );
    }

    switch (activeTool) {
      case 'measure':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-smortr-text-secondary mb-1">
                Scale (pixels per unit)
              </label>
              <input
                type="number"
                value={toolSettings.measure.scale}
                onChange={(e) => dispatch(updateToolSettings({
                  tool: 'measure',
                  settings: { scale: parseFloat(e.target.value) }
                }))}
                className="w-full bg-smortr-bg text-smortr-text rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-smortr-accent border border-smortr-border"
              />
            </div>
            <div>
              <label className="block text-sm text-smortr-text-secondary mb-1">
                Unit
              </label>
              <select
                value={toolSettings.measure.unit}
                onChange={(e) => dispatch(updateToolSettings({
                  tool: 'measure',
                  settings: { unit: e.target.value }
                }))}
                className="w-full bg-smortr-bg text-smortr-text rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-smortr-accent border border-smortr-border"
              >
                <option value="mm">Millimeters (mm)</option>
                <option value="cm">Centimeters (cm)</option>
                <option value="m">Meters (m)</option>
                <option value="in">Inches (in)</option>
                <option value="ft">Feet (ft)</option>
              </select>
            </div>
          </div>
        );
      case 'count':
        const countSettings = toolSettings?.count || {
          brushSize: 3,
          brushColor: '#22c55e',
          captureMode: 'visible'
        };
        
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-smortr-text-secondary mb-2">
                Brush Size: {countSettings.brushSize}px
              </label>
              <input
                type="range"
                min="1"
                max="15"
                value={countSettings.brushSize}
                onChange={(e) => dispatch(updateToolSettings({
                  tool: 'count',
                  settings: { brushSize: parseInt(e.target.value) }
                }))}
                className="w-full h-2 bg-smortr-hover rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #22c55e 0%, #22c55e ${(countSettings.brushSize / 15) * 100}%, #374151 ${(countSettings.brushSize / 15) * 100}%, #374151 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-smortr-text-secondary mt-1">
                <span>Fine</span>
                <span>Bold</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-smortr-text-secondary mb-2">
                Marking Color
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { color: '#22c55e', name: 'Green' },
                  { color: '#3b82f6', name: 'Blue' },
                  { color: '#ef4444', name: 'Red' },
                  { color: '#f59e0b', name: 'Orange' },
                  { color: '#8b5cf6', name: 'Purple' }
                ].map(({ color, name }) => (
                  <button
                    key={color}
                    onClick={() => dispatch(updateToolSettings({
                      tool: 'count',
                      settings: { brushColor: color }
                    }))}
                    className={`relative w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                      countSettings.brushColor === color 
                        ? 'border-smortr-accent ring-2 ring-smortr-accent/50 shadow-lg' 
                        : 'border-smortr-border hover:border-smortr-accent/50'
                    }`}
                    style={{ backgroundColor: color }}
                    title={name}
                  >
                    {countSettings.brushColor === color && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-smortr-text-secondary mb-2">
                Analysis Mode
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => dispatch(updateToolSettings({
                    tool: 'count',
                    settings: { captureMode: 'visible' }
                  }))}
                  className={`w-full px-4 py-3 rounded-lg border transition-all text-left ${
                    countSettings.captureMode === 'visible'
                      ? 'border-smortr-accent bg-smortr-accent/10 text-smortr-accent'
                      : 'border-smortr-border text-smortr-text-secondary hover:border-smortr-accent/50 hover:text-smortr-text'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <div className="font-medium">Visible Canvas</div>
                      <div className="text-xs opacity-75">Count items in current view</div>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => dispatch(updateToolSettings({
                    tool: 'count',
                    settings: { captureMode: 'whole' }
                  }))}
                  className={`w-full px-4 py-3 rounded-lg border transition-all text-left relative ${
                    countSettings.captureMode === 'whole'
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                      : 'border-smortr-border text-smortr-text-secondary hover:border-yellow-400/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <div className="font-medium">Whole File</div>
                      <div className="text-xs opacity-75">Count across entire document</div>
                    </div>
                    <div className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded-full font-medium">
                      Not Ready
                    </div>
                  </div>
                </button>
              </div>
            </div>
            
            <div className="pt-2 border-t border-smortr-border">
              <div className="text-xs text-smortr-text-secondary space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Draw around items to mark them</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>AI will count marked occurrences</span>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="p-2 bg-smortr-hover rounded">
            <p className="text-sm text-smortr-text-secondary">
              No settings available for this tool
            </p>
          </div>
        );
    }
  };

  return (
    <aside className="w-72 bg-smortr-sidebar border-r border-smortr-border h-full overflow-y-auto flex flex-col shadow-smortr">
      <div className="p-6 space-y-6">
        {/* Tools Section */}
        <div className="card space-y-2">
          <h3 className="font-semibold text-lg text-smortr-text mb-2">Tools</h3>
          <div className="flex flex-col gap-1">
            {tools.map((tool) => (
              <button
                key={tool.id}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition group icon-btn text-base font-medium justify-start relative ${
                  activeTool === tool.id
                    ? 'bg-gradient-to-r from-smortr-accent-2/80 to-smortr-accent/80 text-white shadow-smortr-lg' 
                    : 'text-smortr-text-secondary hover:bg-smortr-hover hover:text-smortr-accent'
                }`}
                title={tool.description}
                onClick={() => handleToolClick(tool.id)}
              >
                <tool.icon className="w-5 h-5" />
                <span>{tool.name}</span>
                {activeTool === tool.id && (
                  <span className="absolute left-0 top-0 h-full w-1.5 bg-smortr-accent-2 rounded-l-xl" />
                )}
              </button>
            ))}
          </div>
        </div>
        {/* Active Tool Settings */}
        <div className="card mt-4">
          <h3 className="font-semibold text-lg text-smortr-text mb-2">Tool Settings</h3>
          {renderToolSettings()}
        </div>
      </div>
    </aside>
  );
};

export default LeftSidebar; 