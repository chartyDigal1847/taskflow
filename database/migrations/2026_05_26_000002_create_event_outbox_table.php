<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_outbox', function (Blueprint $table) {
            $table->id();
            $table->string('event_id', 64)->unique();
            $table->string('event_name', 100)->index();
            $table->string('source_service', 50)->default('taskflow');
            $table->string('schema_version', 10)->default('1.0');
            $table->string('correlation_id', 64)->nullable()->index();
            $table->json('payload');
            $table->string('hmac_signature', 128)->nullable();
            $table->string('nonce', 64)->nullable();
            $table->enum('status', ['pending', 'sent', 'failed'])->default('pending')->index();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('sent_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_outbox');
    }
};
