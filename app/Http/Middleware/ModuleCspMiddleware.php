<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ModuleCspMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        $portalUrl = config('app.portal_url', 'https://deoris.test');
        $debugConnectSrc = app()->hasDebugModeEnabled() ? ' http://127.0.0.1:7481' : '';

        $csp = implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' " . $portalUrl,
            "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' " . $portalUrl,
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
            "img-src 'self' data:",
            "connect-src 'self' " . $portalUrl . $debugConnectSrc,
            "frame-ancestors " . $portalUrl,
            "frame-src 'self'",
            "object-src 'none'",
        ]);

        $response->headers->set('Content-Security-Policy', $csp);

        return $response;
    }
}
