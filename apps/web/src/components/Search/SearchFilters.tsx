import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { SearchFilters } from '@shared/types';

interface SearchFiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onReset: () => void;
}

export default function SearchFiltersComponent({
  filters,
  onChange,
  onReset,
}: SearchFiltersProps) {
  const handleChange = (field: keyof SearchFilters, value: any) => {
    onChange({
      ...filters,
      [field]: value,
    });
  };

  const handleZoningCodesChange = (value: string) => {
    const codes = value.split(',').map(code => code.trim()).filter(Boolean);
    handleChange('zoningCodes', codes.length > 0 ? codes : []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Search Filters</h3>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>

      {/* Lot Size */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Min Lot Size (sq ft)"
          type="number"
          value={filters.lotSizeMin || ''}
          onChange={(e) => handleChange('lotSizeMin', e.target.value ? Number(e.target.value) : undefined)}
          placeholder="0"
        />
        <Input
          label="Max Lot Size (sq ft)"
          type="number"
          value={filters.lotSizeMax || ''}
          onChange={(e) => handleChange('lotSizeMax', e.target.value ? Number(e.target.value) : undefined)}
          placeholder="No limit"
        />
      </div>

      {/* Rear Yard Minimum */}
      <Input
        label="Min Rear Yard (sq ft)"
        type="number"
        value={filters.minRearSqft}
        onChange={(e) => handleChange('minRearSqft', Number(e.target.value))}
        helperText="Minimum free rear yard area required"
      />

      {/* Zoning Codes */}
      <Input
        label="Zoning Codes"
        value={(filters.zoningCodes || []).join(', ')}
        onChange={(e) => handleZoningCodesChange(e.target.value)}
        placeholder="R1, R2, R3 (comma separated)"
        helperText="Leave empty to include all zoning types"
      />

      {/* Pool Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pool Requirement
        </label>
        <select
          value={filters.hasPool === undefined ? 'any' : filters.hasPool ? 'yes' : 'no'}
          onChange={(e) => {
            const value = e.target.value;
            handleChange('hasPool', value === 'any' ? undefined : value === 'yes');
          }}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="any">Any</option>
          <option value="yes">Must have pool</option>
          <option value="no">No pool</option>
        </select>
      </div>

      {/* HOA Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          HOA Status
        </label>
        <select
          value={filters.hoaStatus || 'unknown'}
          onChange={(e) => handleChange('hoaStatus', e.target.value as 'unknown' | 'yes' | 'no')}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="unknown">Unknown</option>
          <option value="yes">Has HOA</option>
          <option value="no">No HOA</option>
        </select>
      </div>

      {/* Last Sale Date Range */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Sale Date From"
          type="date"
          value={filters.lastSaleDateFrom || ''}
          onChange={(e) => handleChange('lastSaleDateFrom', e.target.value || undefined)}
        />
        <Input
          label="Sale Date To"
          type="date"
          value={filters.lastSaleDateTo || ''}
          onChange={(e) => handleChange('lastSaleDateTo', e.target.value || undefined)}
        />
      </div>
    </div>
  );
}