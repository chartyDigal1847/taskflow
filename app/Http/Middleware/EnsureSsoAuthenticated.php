<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSsoAuthenticated
{
    protected array $except = [
        '/',
        'sso/redirect',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->shouldSkip($request)) {
            return $next($request);
        }

        if ($request->is('taskflow/api/*') && ! $this->hasSsoContext($request)) {
            return response()->json([
                'success' => false,
                'error' => 'unauthenticated',
                'message' => 'SSO authentication required.',
            ], 401);
        }

        if (! $request->is('taskflow/api/*') && ! $this->hasSsoContext($request)) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            return redirect('/');
        }

        return $next($request);
    }

    protected function shouldSkip(Request $request): bool
    {
        foreach ($this->except as $except) {
            if ($request->is($except)) {
                return true;
            }
        }

        return false;
    }

    protected function hasSsoContext(Request $request): bool
    {
        try {
            $session = $request->session();
        } catch (\RuntimeException) {
            return false;
        }

        return $session->has('sso_id')
            && $session->has('sso_role')
            && $session->has('sso_email')
            && ! empty($session->get('sso_id'));
    }
}
