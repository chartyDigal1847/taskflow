<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>TaskFlow</title>
    <link rel="icon" href="{{ asset('favicon.ico') }}" type="image/x-icon">
    <!-- Google Fonts — loaded here so CSP font-src applies correctly -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&display=swap">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="{{ asset('css/taskflow.css') }}?v={{ filemtime(public_path('css/taskflow.css')) }}">
    <script>
        // ── Module configuration ──────────────────────────────────────────────
        // API base URL — this module's own origin for its own API calls
        window.TASKFLOW_API_BASE = "{{ config('app.url') }}";

        // Portal origin for SSO handshake — the parent portal that embeds this module
        window.PORTAL_ORIGIN = "{{ config('app.portal_url') }}";

        // SSO timeout (ms) — how long to wait for portal response before showing error
        window.SSO_TIMEOUT_MS = 8000;

        // Use the standardized flow: module backend exchanges token with DEORIS.
        window.DEORIS_SSO_MODE = "module";
    </script>
</head>
<body>

<!-- ── Root container ────────────────────────────────────────────────────── -->
<!-- This is the ONLY static HTML. Everything else is injected by JS after SSO. -->
<div id="taskflow-root" style="
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #F4F6F9;
">
    <!-- Loading state — shown until module:ready fires -->
    <div id="taskflow-loader" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        text-align: center;
    ">
        <div style="
            width: 56px; height: 56px; border-radius: 14px;
            background: linear-gradient(135deg, #722F37, #8B3A3A);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 20px rgba(114,47,55,.35);
            margin-bottom: 4px;
        ">
            <i class="fa-solid fa-tasks" style="color:#fff;font-size:24px;"></i>
        </div>
        <div>
            <p style="color:#722F37;font-weight:800;font-size:17px;letter-spacing:-.01em;margin-bottom:4px;">TaskFlow</p>
            <p style="color:#6b7280;font-size:13px;">Authenticating…</p>
        </div>
        <div style="
            width: 40px; height: 40px; border-radius: 50%;
            border: 3px solid rgba(114,47,55,.15);
            border-top-color: #722F37;
            animation: spin .8s linear infinite;
        "></div>
        <p id="taskflow-loader-error" style="
            color: #dc2626; font-size: 13px; display: none;
            max-width: 360px; background: rgba(220,38,38,.06);
            border: 1px solid rgba(220,38,38,.2); border-radius: 8px;
            padding: 10px 16px;
        "></p>
    </div>
</div>

<style>
@keyframes spin { to { transform: rotate(360deg); } }
</style>

<!-- ── Scripts ───────────────────────────────────────────────────────────── -->
<!-- module-bridge.js MUST load first — it owns the SSO lifecycle -->
<script src="{{ rtrim(config('app.portal_url'), '/') }}/module-bridge.js"></script>
<!-- taskflow.js listens for "module:ready" before booting -->
<script src="{{ asset('js/taskflow.js') }}?v={{ filemtime(public_path('js/taskflow.js')) }}"></script>

</body>
</html>
