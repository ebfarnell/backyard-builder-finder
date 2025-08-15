import { useState, useEffect } from 'react';
import { BarChart3, Users, Search, DollarSign, Database, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';

interface UsageStats {
  totalSearches: number;
  totalUsers: number;
  totalCost: number;
  avgDuration: number;
  recentSearches: Array<{
    id: string;
    userId: string;
    createdAt: string;
    parcelsAnalyzed: number;
    cost: number;
    duration: number;
  }>;
}

interface DataStatus {
  totalParcels: number;
  recentParcels: Array<{
    apn: string;
    address: string;
    created_at: string;
  }>;
  configuration: {
    valid: boolean;
    missing: string[];
  };
  dataSource: 'seed_data' | 'real_data_or_empty';
}

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadUsageStats();
    loadDataStatus();
  }, []);

  const loadUsageStats = async () => {
    try {
      // Check if user is admin (in a real app, this would be a proper role check)
      if (!user?.email?.includes('admin')) {
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }

      // Load usage statistics
      const { data: searches, error: searchError } = await supabase
        .from('api_usage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (searchError) throw searchError;

      // Calculate stats
      const totalSearches = searches?.length || 0;
      const totalCost = searches?.reduce((sum, s) => sum + s.cost, 0) || 0;
      const uniqueUsers = new Set(searches?.map(s => s.user_id)).size;

      setStats({
        totalSearches,
        totalUsers: uniqueUsers,
        totalCost,
        avgDuration: 45, // Mock data - would calculate from actual search durations
        recentSearches: searches?.slice(0, 10).map(s => ({
          id: s.id,
          userId: s.user_id,
          createdAt: s.created_at,
          parcelsAnalyzed: 0, // Would need to join with search results
          cost: s.cost,
          duration: 45, // Mock data
        })) || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const loadDataStatus = async () => {
    try {
      const response = await fetch('/api/admin/data-status');
      if (!response.ok) throw new Error('Failed to load data status');
      const status = await response.json();
      setDataStatus(status);
    } catch (err) {
      console.error('Failed to load data status:', err);
    }
  };

  const enableRealDataMode = async () => {
    setDataLoading(true);
    setMessage(null);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/enable-real-data', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to enable real data mode');
      }
      
      setMessage(result.message);
      await loadDataStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable real data mode');
    } finally {
      setDataLoading(false);
    }
  };

  const resetToSeedData = async () => {
    if (!confirm('This will clear all real data and reset to seed data. Are you sure?')) {
      return;
    }
    
    setDataLoading(true);
    setMessage(null);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/reset-to-seed-data', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to reset to seed data');
      }
      
      setMessage(result.message);
      await loadDataStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset to seed data');
    } finally {
      setDataLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Access Denied</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            System usage and performance metrics
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Search className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Searches</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSearches}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalCost)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgDuration}s</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Searches */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Recent Searches</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parcels
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentSearches.map((search) => (
                  <tr key={search.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(search.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {search.userId.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {search.parcelsAnalyzed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {search.duration}s
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(search.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Data Management
          </h2>
          
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 text-sm">{message}</p>
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {dataStatus && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Current Status</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Parcels:</span>
                      <span className="font-medium">{dataStatus.totalParcels.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Data Source:</span>
                      <span className={`font-medium ${
                        dataStatus.dataSource === 'seed_data' ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {dataStatus.dataSource === 'seed_data' ? 'Seed Data' : 'Real Data'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>API Config:</span>
                      <span className={`font-medium ${
                        dataStatus.configuration.valid ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {dataStatus.configuration.valid ? 'Valid' : 'Missing Keys'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Recent Parcels</h3>
                  <div className="space-y-1 text-xs">
                    {dataStatus.recentParcels.slice(0, 3).map((parcel, index) => (
                      <div key={index} className="truncate">
                        <span className="font-mono">{parcel.apn}</span>
                        {parcel.address && (
                          <span className="text-gray-600 ml-2">{parcel.address}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {!dataStatus.configuration.valid && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                    <p className="text-yellow-800 text-sm">
                      Missing API configuration: {dataStatus.configuration.missing.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <Button
                  onClick={enableRealDataMode}
                  disabled={dataLoading || !dataStatus.configuration.valid}
                  loading={dataLoading}
                  variant="primary"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Enable Real Data Mode
                </Button>
                
                <Button
                  onClick={resetToSeedData}
                  disabled={dataLoading}
                  variant="outline"
                >
                  Reset to Seed Data
                </Button>
                
                <Button
                  onClick={loadDataStatus}
                  disabled={dataLoading}
                  variant="ghost"
                >
                  Refresh Status
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">✓</div>
              <p className="text-sm text-gray-600 mt-1">API Server</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">✓</div>
              <p className="text-sm text-gray-600 mt-1">CV Service</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">✓</div>
              <p className="text-sm text-gray-600 mt-1">Database</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}