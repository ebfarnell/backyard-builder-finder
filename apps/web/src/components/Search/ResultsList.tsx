import { CheckCircle, XCircle, MapPin, Home, Waves } from 'lucide-react';
import type { Parcel } from '@shared/types';

interface ResultsListProps {
  results: Parcel[];
  onParcelSelect?: (parcel: Parcel) => void;
  selectedParcelId?: string;
}

export default function ResultsList({
  results,
  onParcelSelect,
  selectedParcelId,
}: ResultsListProps) {
  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatArea = (sqft: number | null) => {
    if (!sqft) return 'N/A';
    return new Intl.NumberFormat('en-US').format(Math.round(sqft)) + ' sq ft';
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No results to display</p>
        <p className="text-sm">Draw an area on the map and run a search</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Search Results ({results.length})</h3>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {results.map((parcel) => (
          <div
            key={parcel.id}
            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
              selectedParcelId === parcel.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => onParcelSelect?.(parcel)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-sm truncate">
                    {parcel.address || parcel.apn}
                  </h4>
                  {parcel.qualifies !== null && (
                    parcel.qualifies ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )
                  )}
                </div>

                <div className="mt-1 space-y-1">
                  <div className="flex items-center space-x-4 text-xs text-gray-600">
                    <span className="flex items-center space-x-1">
                      <Home className="h-3 w-3" />
                      <span>{formatArea(parcel.lotArea)}</span>
                    </span>
                    {parcel.hasPool && (
                      <span className="flex items-center space-x-1">
                        <Waves className="h-3 w-3" />
                        <span>Pool</span>
                      </span>
                    )}
                  </div>

                  {parcel.rearFreeSqft && (
                    <p className="text-xs text-gray-600">
                      Rear yard: {formatArea(parcel.rearFreeSqft)}
                    </p>
                  )}

                  {parcel.zoningCode && (
                    <p className="text-xs text-gray-600">
                      Zoning: {parcel.zoningCode}
                    </p>
                  )}

                  {parcel.lastSalePrice && (
                    <p className="text-xs text-gray-600">
                      Last sale: {formatCurrency(parcel.lastSalePrice)} ({formatDate(parcel.lastSaleDate)})
                    </p>
                  )}

                  {parcel.rationale && (
                    <p className="text-xs text-gray-700 italic mt-2">
                      "{parcel.rationale}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}