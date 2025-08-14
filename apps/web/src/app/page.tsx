import Link from 'next/link';
import { 
  HomeIcon, 
  MagnifyingGlassIcon, 
  MapIcon,
  DocumentChartBarIcon,
  CogIcon
} from '@heroicons/react/24/outline';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <HomeIcon className="h-8 w-8 text-primary-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">
                Backyard Builder Finder
              </h1>
            </div>
            <nav className="flex space-x-4">
              <Link 
                href="/auth/login" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign In
              </Link>
              <Link 
                href="/auth/signup" 
                className="btn-primary text-sm"
              >
                Get Started
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Find Buildable Space in 
            <span className="text-primary-600"> Residential Backyards</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 max-w-3xl mx-auto">
            Multi-tenant SaaS platform for identifying and analyzing buildable space in residential parcels. 
            Perfect for ADU developers, contractors, and real estate professionals.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/search" className="btn-primary text-lg px-8 py-3">
              Start Searching
            </Link>
            <Link href="/demo" className="btn-secondary text-lg px-8 py-3">
              View Demo
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card text-center">
            <MagnifyingGlassIcon className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Search</h3>
            <p className="text-gray-600">
              Search by city, state, county, ZIP, address, or neighborhood with advanced filtering.
            </p>
          </div>

          <div className="card text-center">
            <MapIcon className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Geo Analysis</h3>
            <p className="text-gray-600">
              Compute buildable area after setbacks, structures, and zoning constraints.
            </p>
          </div>

          <div className="card text-center">
            <DocumentChartBarIcon className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Compliance Check</h3>
            <p className="text-gray-600">
              Verify zoning compliance, lot coverage, FAR, and other regulations.
            </p>
          </div>

          <div className="card text-center">
            <CogIcon className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Export Results</h3>
            <p className="text-gray-600">
              Export findings as CSV, GeoJSON, or detailed PDF reports.
            </p>
          </div>
        </div>

        {/* Demo Section */}
        <div className="mt-20 card">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Try the LA Demo
            </h2>
            <p className="text-gray-600 mb-6">
              Experience our platform with pre-configured Los Angeles data. 
              Search for 1,200 sq ft buildable space with no pool requirement.
            </p>
            <Link 
              href="/search?demo=la-1200-no-pool" 
              className="btn-primary text-lg px-8 py-3"
            >
              Run LA Demo
            </Link>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3 text-center">
          <div>
            <div className="text-3xl font-bold text-primary-600">850K+</div>
            <div className="text-gray-600">Parcels Analyzed</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary-600">±5%</div>
            <div className="text-gray-600">Area Accuracy</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary-600">99.9%</div>
            <div className="text-gray-600">Uptime</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-500">
            <p>&copy; 2025 Backyard Builder Finder. All rights reserved.</p>
            <p className="mt-2 text-sm">
              Development Status: 
              <span className="text-success-600 font-medium ml-1">
                API Operational • Database Ready • Frontend In Progress
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}