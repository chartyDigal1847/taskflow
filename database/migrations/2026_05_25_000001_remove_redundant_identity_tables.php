<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('submissions') && Schema::hasColumn('submissions', 'user_id')) {
            Schema::table('submissions', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
                $table->dropColumn('user_id');
            });
        }

        if (Schema::hasTable('submissions') && ! Schema::hasColumn('submissions', 'portal_user_id')) {
            Schema::table('submissions', function (Blueprint $table) {
                $table->unsignedBigInteger('portal_user_id')->after('assignment_id');
                $table->index('portal_user_id');
                $table->index(['assignment_id', 'portal_user_id']);
            });
        }

        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('evaluations');
        Schema::dropIfExists('users');
    }

    public function down(): void
    {
        // Intentionally no rollback — local identity tables must not return.
    }
};
