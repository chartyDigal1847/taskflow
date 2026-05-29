<?php

use App\Http\Controllers\TaskflowController;
use App\Http\Middleware\EnsureSsoAuthenticated;
use Illuminate\Support\Facades\Route;

// ── Public routes ─────────────────────────────────────────────────────────
Route::get('/', [TaskflowController::class, 'index'])->name('home');
Route::post('/sso/exchange', [TaskflowController::class, 'ssoExchange'])->name('sso.exchange');
Route::post('/sso/redirect', [TaskflowController::class, 'ssoRedirect'])->name('sso.redirect');
Route::get('/sso/redirect', [TaskflowController::class, 'ssoRedirect'])->name('sso.redirect.dev');
Route::match(['get', 'post'], '/logout', [TaskflowController::class, 'logout'])->name('logout');

// ── Authenticated API ─────────────────────────────────────────────────────
Route::prefix('taskflow/api')
    ->middleware(EnsureSsoAuthenticated::class)
    ->group(function () {

        // Bootstrap (single call to hydrate the SPA)
        Route::get('/bootstrap', [TaskflowController::class, 'bootstrap']);

        // Assignments
        Route::get('/assignments',              [TaskflowController::class, 'indexAssignments']);
        Route::get('/assignments/{id}',         [TaskflowController::class, 'showAssignment']);
        Route::post('/assignments',             [TaskflowController::class, 'storeAssignment']);
        Route::put('/assignments/{id}',         [TaskflowController::class, 'updateAssignment']);
        Route::patch('/assignments/{id}/status',[TaskflowController::class, 'updateAssignmentStatus']);
        Route::delete('/assignments/{id}',      [TaskflowController::class, 'destroyAssignment']);

        // Submissions
        Route::get('/submissions',                      [TaskflowController::class, 'indexSubmissions']);
        Route::post('/submissions',                     [TaskflowController::class, 'storeSubmission']);
        Route::patch('/submissions/{id}/grade',         [TaskflowController::class, 'gradeSubmission']);
        Route::patch('/submissions/{id}/release-feedback', [TaskflowController::class, 'releaseFeedback']);
        Route::delete('/submissions/{id}',              [TaskflowController::class, 'destroySubmission']);
        Route::get('/submissions/{id}/download',        [TaskflowController::class, 'downloadSubmissionFile']);

        // Feedback
        Route::get('/feedback', [TaskflowController::class, 'indexFeedback']);

        // Deadlines & Calendar
        Route::get('/deadlines', [TaskflowController::class, 'indexDeadlines']);
        Route::get('/calendar',  [TaskflowController::class, 'calendar']);

        // Search (federated)
        Route::get('/search', [TaskflowController::class, 'search']);

        // Analytics (instructor only)
        Route::get('/analytics', [TaskflowController::class, 'analytics']);
    });
