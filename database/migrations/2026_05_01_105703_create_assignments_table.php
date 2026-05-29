<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('assignments', function (Blueprint $table) {
        $table->id();
        $table->string('title');
        $table->string('subject');
        $table->string('grade');
        $table->string('type')->default('written');
        $table->string('priority')->default('medium');
        $table->string('quarter')->default('Q4');
        $table->date('due_date');
        $table->integer('points')->default(100);
        $table->text('description')->nullable();
        $table->string('status')->default('pending');
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignments');
    }
};
