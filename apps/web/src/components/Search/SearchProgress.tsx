import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { SearchProgress } from '@shared/types';

interface SearchProgressProps {
  progress: SearchProgress;
}

export default function SearchProgressComponent({ progress }: SearchProgressProps) {
  const getStageIcon = (stage: SearchProgress['stage']) => {
    switch (stage) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
  };

  const getStageLabel = (stage: SearchProgress['stage']) => {
    switch (stage) {
      case 'starting':
        return 'Starting search...';
      case 'sql_filter':
        return 'Filtering parcels...';
      case 'cv_analysis':
        return 'Analyzing imagery...';
      case 'llm_analysis':
        return 'AI analysis...';
      case 'complete':
        return 'Search complete';
      case 'error':
        return 'Search failed';
      default:
        return 'Processing...';
    }
  };

  const progressPercentage = progress.total > 0 
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center space-x-3">
        {getStageIcon(progress.stage)}
        <div className="flex-1">
          <h3 className="font-medium">{getStageLabel(progress.stage)}</h3>
          <p className="text-sm text-gray-600">{progress.message}</p>
        </div>
      </div>

      {progress.total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{progress.processed} / {progress.total} ({progressPercentage}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {progress.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{progress.error}</p>
        </div>
      )}

      {progress.stage === 'complete' && progress.results && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <p className="text-sm text-green-800">
            Found {progress.results.length} parcels matching your criteria
          </p>
        </div>
      )}
    </div>
  );
}