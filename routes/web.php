<?php

use App\Http\Controllers\HomeController;
use App\Http\Controllers\ListingController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Api\PublicListingController;
use Illuminate\Support\Facades\Route;

$serve = static function (string $file) {
    $path = public_path($file);
    abort_unless(file_exists($path), 404);

    return response(file_get_contents($path), 200)
        ->header('Content-Type', 'text/html; charset=UTF-8');
};

// Public frontend: exact Finder pages (1:1 look)
Route::get('/', fn () => $serve('home-contractors.html'))->name('home');
Route::get('/contractors', fn () => $serve('home-contractors.html'));
Route::get('/real-estate', fn () => $serve('home-real-estate.html'));
Route::get('/cars', fn () => $serve('home-cars.html'));
Route::get('/events', fn () => $serve('home-events.html'));

Route::get('/listings', fn () => $serve('listings-contractors.html'))->name('listings.index');
Route::get('/listings/contractors', fn () => $serve('listings-contractors.html'))->name('listings.module');
Route::get('/listings/real-estate', fn () => $serve('listings-real-estate.html'));
Route::get('/listings/cars', fn () => $serve('listings-grid-cars.html'));
Route::get('/listings/events', fn () => $serve('listings-events.html'));

Route::get('/entry/contractors', fn () => $serve('single-entry-contractors.html'))->name('finder.entry');
Route::get('/entry/real-estate', fn () => $serve('single-entry-real-estate.html'));
Route::get('/entry/cars', fn () => $serve('single-entry-cars.html'));
Route::get('/entry/events', fn () => $serve('single-entry-events.html'));

// Dynamic version (kept separately)
Route::prefix('app')->group(function () {
    Route::get('/', [HomeController::class, 'index'])->name('app.home');
    Route::get('/listings', [ListingController::class, 'index'])->name('app.listings.index');
    Route::get('/listings/{module}', [ListingController::class, 'index'])
        ->whereIn('module', ['contractors', 'real-estate', 'cars', 'events'])
        ->name('app.listings.module');
    Route::get('/entry/{listing:slug}', [ListingController::class, 'show'])->name('app.listings.show');
});

// Public JSON endpoints for static Finder pages wiring
Route::prefix('api/monaclick')->group(function () {
    Route::get('/listings', [PublicListingController::class, 'index']);
    Route::get('/entry', [PublicListingController::class, 'show']);
});

Route::get('/dashboard', function () {
    return redirect('/admin');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__ . '/auth.php';
