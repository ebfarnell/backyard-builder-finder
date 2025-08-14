import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check backend API health
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const apiHealthResponse = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Short timeout for health checks
      signal: AbortSignal.timeout(5000),
    });

    const apiHealth = apiHealthResponse.ok ? 
      await apiHealthResponse.json() : 
      { status: 'unhealthy', error: 'API not responding' };

    // Frontend health status
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      components: {
        frontend: {
          status: 'healthy',
          nextjs_version: process.env.npm_package_dependencies_next || 'unknown',
        },
        backend_api: {
          status: apiHealthResponse.ok ? 'healthy' : 'unhealthy',
          url: apiUrl,
          response_time_ms: apiHealthResponse.ok ? 
            parseInt(apiHealthResponse.headers.get('x-response-time') || '0') : 
            null,
          last_check: new Date().toISOString(),
        }
      }
    };

    // Overall status determination
    if (!apiHealthResponse.ok) {
      health.status = 'degraded';
    }

    return NextResponse.json(health, {
      status: health.status === 'healthy' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'frontend',
      },
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        components: {
          frontend: {
            status: 'healthy',
          },
          backend_api: {
            status: 'unhealthy',
            error: 'Connection failed',
          }
        }
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Health-Check': 'frontend',
        },
      }
    );
  }
}