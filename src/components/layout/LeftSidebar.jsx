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