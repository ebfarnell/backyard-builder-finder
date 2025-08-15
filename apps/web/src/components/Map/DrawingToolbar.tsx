import { Edit3, Square, Circle, Hand, Trash2, Download, Upload } from 'lucide-react';

interface DrawingToolbarProps {
  drawingMode: 'polygon' | 'rectangle' | 'circle' | null;
  onStartDrawing: (mode: 'polygon' | 'rectangle' | 'circle') => void;
  onStopDrawing: () => void;
  onClearDrawing: () => void;
  onExportAOI?: () => void;
  onImportAOI?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  hasDrawing: boolean;
}

export default function DrawingToolbar({
  drawingMode,
  onStartDrawing,
  onStopDrawing,
  onClearDrawing,
  onExportAOI,
  onImportAOI,
  hasDrawing,
}: DrawingToolbarProps) {
  const toolButtons = [
    {
      id: 'polygon',
      mode: 'polygon' as const,
      icon: Edit3,
      label: 'Polygon',
      description: 'Draw custom polygon area'
    },
    {
      id: 'rectangle',
      mode: 'rectangle' as const,
      icon: Square,
      label: 'Rectangle',
      description: 'Draw rectangular area'
    },
    {
      id: 'circle',
      mode: 'circle' as const,
      icon: Circle,
      label: 'Circle',
      description: 'Draw circular area'
    },
  ];

  return (
    <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-3">
        <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center">
          <Edit3 className="h-3 w-3 mr-1" />
          Drawing Tools
        </div>
        
        {/* Drawing Mode Buttons */}
        <div className="space-y-1 mb-3">
          {toolButtons.map(({ id, mode, icon: Icon, label, description }) => (
            <button
              key={id}
              onClick={() => onStartDrawing(mode)}
              className={`w-full flex items-center px-3 py-2 text-sm rounded-md transition-all duration-200 group ${
                drawingMode === mode
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm'
              }`}
              title={description}
            >
              <Icon className={`h-4 w-4 mr-2 ${
                drawingMode === mode ? 'text-white' : 'text-gray-500 group-hover:text-blue-600'
              }`} />
              {label}
              {drawingMode === mode && (
                <div className="ml-auto">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Control Buttons */}
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <button
            onClick={onStopDrawing}
            disabled={!drawingMode}
            className="w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Stop drawing and select existing shapes"
          >
            <Hand className="h-4 w-4 mr-2 text-gray-500" />
            Select
          </button>
          
          <button
            onClick={onClearDrawing}
            disabled={!hasDrawing}
            className="w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear all drawings"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </button>
        </div>

        {/* Import/Export Buttons */}
        {(onImportAOI || onExportAOI) && (
          <div className="border-t border-gray-200 pt-3 mt-3 space-y-1">
            {onImportAOI && (
              <label className="w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer">
                <input
                  type="file"
                  accept=".geojson,.json"
                  onChange={onImportAOI}
                  className="hidden"
                />
                <Upload className="h-4 w-4 mr-2" />
                Import GeoJSON
              </label>
            )}
            
            {onExportAOI && (
              <button
                onClick={onExportAOI}
                disabled={!hasDrawing}
                className="w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export current area as GeoJSON"
              >
                <Download className="h-4 w-4 mr-2" />
                Export AOI
              </button>
            )}
          </div>
        )}
      </div>

      {/* Area Statistics */}
      {hasDrawing && (
        <div className="border-t border-gray-200 px-3 py-2 bg-gray-50 rounded-b-lg">
          <div className="text-xs text-gray-600">
            ✓ Area selected for search
          </div>
        </div>
      )}
    </div>
  );
}