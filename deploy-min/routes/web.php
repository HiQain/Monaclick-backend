<?php

use App\Http\Controllers\HomeController;
use App\Http\Controllers\ListingController;
use App\Http\Controllers\ListingSubmissionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\CarListingSubmissionController;
use App\Http\Controllers\Api\PublicListingController;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;

$serve = static function (string $file) {
    $path = public_path($file);
    abort_unless(file_exists($path), 404);
    $html = file_get_contents($path);
    $html = str_replace('data-pwa="true"', 'data-pwa="false"', $html);
    $html = str_replace('__CSRF_TOKEN__', csrf_token(), $html);
    if (str_starts_with($file, 'account-') && Auth::check()) {
        $user = Auth::user();
        $name = htmlspecialchars((string) ($user?->name ?? 'Monaclick User'), ENT_QUOTES, 'UTF-8');
        $email = htmlspecialchars((string) ($user?->email ?? ''), ENT_QUOTES, 'UTF-8');
        $namePlaceholders = [
            'Jerome Bell',
            'Michael Williams',
        ];
        $emailPlaceholders = [
            'jerome.bell@example.com',
            'm.williams@example.com',
        ];
        $html = str_replace($namePlaceholders, $name, $html);
        $html = str_replace($emailPlaceholders, $email, $html);

        $listingCount = Listing::query()->where('user_id', $user?->id)->count();
        $hasReviewsTable = DB::getSchemaBuilder()->hasTable('reviews');
        $hasFavoritesTable = DB::getSchemaBuilder()->hasTable('favorites');
        $reviewCount = $hasReviewsTable ? DB::table('reviews')->where('user_id', $user?->id)->count() : 0;
        $favoriteCount = $hasFavoritesTable ? DB::table('favorites')->where('user_id', $user?->id)->count() : 0;
        $isNewUser = $listingCount === 0 && $reviewCount === 0 && $favoriteCount === 0;

        if ($isNewUser) {
            if ($file === 'account-profile.html') {
                $emptyProfileScript = <<<'HTML'
<script>
(() => {
  const profileRoot = document.querySelector('.col-lg-9');
  if (!profileRoot) return;

  const walletSection = profileRoot.querySelector('section.row.g-3.g-xl-4.pb-5.mb-md-3');
  if (walletSection) walletSection.remove();

  const userInfoSection = profileRoot.querySelector('section.pb-5.mb-md-3');
  if (userInfoSection) {
    const phone = userInfoSection.querySelector('li:nth-child(2)');
    const location = userInfoSection.querySelector('li:nth-child(3)');
    if (phone) phone.remove();
    if (location) location.remove();

    const bio = userInfoSection.querySelector('p.fs-sm.pb-sm-1.pb-md-0.mb-md-4');
    if (bio) bio.textContent = 'Your profile is empty. Add your details from Account settings.';
  }

  const listingsSection = Array.from(profileRoot.querySelectorAll('section.pb-5.mb-md-3'))
    .find((section) => section.querySelector('h2.h4')?.textContent?.trim() === 'My listings');

  if (listingsSection) {
    listingsSection.innerHTML = `
      <div class="card border-0 bg-body-tertiary">
        <div class="card-body py-5 text-center">
          <h3 class="h5 mb-2">No listings yet</h3>
          <p class="text-body-secondary mb-4">You have not added any listings yet. Start by creating your first listing.</p>
          <a class="btn btn-primary" href="/add-listing">Add your first listing</a>
        </div>
      </div>
    `;
  }

  const reviewsSection = Array.from(profileRoot.querySelectorAll('section.pb-5.mb-md-3'))
    .find((section) => section.querySelector('h2.h4')?.textContent?.trim() === 'Reviews');
  if (reviewsSection) {
    reviewsSection.innerHTML = `
      <div class="card border-0 bg-body-tertiary">
        <div class="card-body py-5 text-center">
          <h3 class="h5 mb-2">No reviews yet</h3>
          <p class="text-body-secondary mb-0">Reviews about your profile will appear here.</p>
        </div>
      </div>
    `;
  }

  const favoritesSection = Array.from(profileRoot.querySelectorAll('section.pb-5.mb-md-3'))
    .find((section) => section.querySelector('h2.h4')?.textContent?.trim() === 'Favorites');
  if (favoritesSection) {
    favoritesSection.innerHTML = `
      <div class="card border-0 bg-body-tertiary">
        <div class="card-body py-5 text-center">
          <h3 class="h5 mb-2">No favorites yet</h3>
          <p class="text-body-secondary mb-0">When you save listings, they will show up here.</p>
        </div>
      </div>
    `;
  }
})();
</script>
HTML;
                $html = str_replace('</body>', $emptyProfileScript . '</body>', $html);
            }

            if ($file === 'account-listings.html') {
                $emptyListingsScript = <<<'HTML'
<script>
(() => {
  const listingsRoot = document.querySelector('.col-lg-9');
  if (!listingsRoot) return;

  const navPills = listingsRoot.querySelector('.nav.overflow-x-auto.mb-2');
  const tabContent = listingsRoot.querySelector('.tab-content');
  if (navPills) navPills.remove();
  if (tabContent) tabContent.remove();

  const emptyCard = document.createElement('div');
  emptyCard.className = 'card border-0 bg-body-tertiary mt-3';
  emptyCard.innerHTML = `
    <div class="card-body py-5 text-center">
      <h3 class="h5 mb-2">No listings yet</h3>
      <p class="text-body-secondary mb-4">Your listings will appear here after you publish them.</p>
      <a class="btn btn-primary" href="/add-listing">Add your first listing</a>
    </div>
  `;
  listingsRoot.appendChild(emptyCard);
})();
</script>
HTML;
                $html = str_replace('</body>', $emptyListingsScript . '</body>', $html);
            }

            if ($file === 'account-reviews.html') {
                $emptyReviewsScript = <<<'HTML'
<script>
(() => {
  const root = document.querySelector('.col-lg-9');
  if (!root) return;
  root.innerHTML = `
    <h1 class="h2 pb-2 pb-lg-3">Reviews</h1>
    <div class="card border-0 bg-body-tertiary">
      <div class="card-body py-5 text-center">
        <h3 class="h5 mb-2">No reviews yet</h3>
        <p class="text-body-secondary mb-0">You do not have any reviews yet.</p>
      </div>
    </div>
  `;
})();
</script>
HTML;
                $html = str_replace('</body>', $emptyReviewsScript . '</body>', $html);
            }

            if ($file === 'account-favorites.html') {
                $emptyFavoritesScript = <<<'HTML'
<script>
(() => {
  const root = document.querySelector('.col-lg-9');
  if (!root) return;
  root.innerHTML = `
    <h1 class="h2 pb-2 pb-lg-3">Favorites</h1>
    <div class="card border-0 bg-body-tertiary">
      <div class="card-body py-5 text-center">
        <h3 class="h5 mb-2">No favorites yet</h3>
        <p class="text-body-secondary mb-4">Save listings to quickly find them later.</p>
        <a class="btn btn-primary" href="/listings">Browse listings</a>
      </div>
    </div>
  `;
})();
</script>
HTML;
                $html = str_replace('</body>', $emptyFavoritesScript . '</body>', $html);
            }

            if ($file === 'account-settings.html') {
                $emptySettingsScript = <<<'HTML'
<script>
(() => {
  const root = document.querySelector('.col-lg-9');
  if (!root) return;

  const textInputs = root.querySelectorAll('input[type="text"], input[type="tel"], input[type="date"]');
  textInputs.forEach((input) => {
    if (!input.name || input.type !== 'email') input.value = '';
  });

  const textareas = root.querySelectorAll('textarea');
  textareas.forEach((ta) => ta.value = '');

  root.querySelectorAll('.badge').forEach((badge) => {
    if ((badge.textContent || '').toLowerCase().includes('verified') || (badge.textContent || '').toLowerCase().includes('verify email')) {
      badge.remove();
    }
  });
})();
</script>
HTML;
                $html = str_replace('</body>', $emptySettingsScript . '</body>', $html);
            }
        }
    }

    return response($html, 200)
        ->header('Content-Type', 'text/html; charset=UTF-8')
        ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        ->header('Pragma', 'no-cache')
        ->header('Expires', '0');
};

// Public frontend: exact Finder pages (1:1 look)
Route::get('/', fn () => $serve('home-combined.html'))->name('home');
Route::get('/combined', fn () => $serve('home-combined.html'))->name('home.combined');
Route::get('/contractors', fn () => $serve('home-contractors.html'));
Route::get('/real-estate', fn () => $serve('home-real-estate.html'));
Route::get('/cars', fn () => $serve('home-cars.html'));
Route::get('/events', fn () => $serve('home-events.html'));
Route::get('/restaurants', fn () => $serve('home-restaurants.html'));

Route::get('/listings', fn () => $serve('listings-contractors.html'))->name('listings.index');
Route::get('/listings/contractors', fn () => $serve('listings-contractors.html'))->name('listings.module');
Route::get('/listings/real-estate', fn () => $serve('listings-real-estate.html'));
Route::get('/listings/cars', fn () => $serve('listings-grid-cars.html'));
Route::get('/listings/events', fn () => $serve('listings-events.html'));
Route::get('/listings/restaurants', fn () => $serve('listings-restaurants.html'));

Route::get('/entry/contractors', fn () => $serve('single-entry-contractors.html'))->name('finder.entry');
Route::get('/entry/real-estate', fn () => $serve('single-entry-real-estate.html'));
Route::get('/entry/cars', fn () => $serve('single-entry-cars.html'));
Route::get('/entry/events', fn () => $serve('single-entry-events.html'));
Route::get('/entry/restaurants', fn () => $serve('single-entry-restaurants.html'));
Route::get('/add-listing', fn () => $serve('add-listing.html'));
Route::get('/add-property', fn () => $serve('add-property-type.html'));
Route::get('/add-contractor', fn () => $serve('add-contractor-location.html'));
Route::get('/sell-car', fn () => $serve('add-car.html'));
Route::get('/add-car', fn () => $serve('add-car.html'));
Route::get('/submit/car', CarListingSubmissionController::class);
Route::get('/submit/property', [ListingSubmissionController::class, 'property']);
Route::get('/submit/contractor', [ListingSubmissionController::class, 'contractor']);
Route::get('/submit/restaurant', [ListingSubmissionController::class, 'restaurant']);
Route::get('/add-restaurant', fn () => $serve('add-restaurant.html'));
Route::get('/add-contractor-location', fn () => $serve('add-contractor-location.html'));
Route::get('/about', fn () => $serve('about-v2.html'));
Route::get('/blog', fn () => $serve('blog-layout-v1.html'));
Route::get('/contact', fn () => $serve('contact-v2.html'));
Route::get('/terms-and-conditions', fn () => $serve('terms-and-conditions.html'));
Route::get('/signin', fn () => $serve('account-signin.html'));
Route::get('/signup', fn () => $serve('account-signup.html'));
Route::get('/password-recovery', fn () => $serve('account-password-recovery.html'));
Route::post('/signup', function (Request $request) {
    $data = $request->validate([
        'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        'password' => ['required', 'string', 'min:8'],
    ]);

    $name = ucfirst(str_replace(['.', '_', '-'], ' ', explode('@', $data['email'])[0]));

    User::create([
        'name' => $name ?: 'Monaclick User',
        'email' => strtolower($data['email']),
        'password' => Hash::make($data['password']),
    ]);

    return redirect('/signin?created=1&email=' . urlencode($data['email']));
});
Route::post('/signin', function (Request $request) {
    $credentials = $request->validate([
        'email' => ['required', 'email'],
        'password' => ['required', 'string'],
    ]);

    if (! Auth::attempt(
        ['email' => strtolower($credentials['email']), 'password' => $credentials['password']],
        $request->boolean('remember')
    )) {
        return redirect('/signin?error=invalid&email=' . urlencode($credentials['email']));
    }

    $request->session()->regenerate();

    return redirect('/account/profile');
});
Route::post('/password-recovery', function (Request $request) {
    $data = $request->validate([
        'email' => ['required', 'email'],
    ]);

    $exists = User::query()->where('email', strtolower($data['email']))->exists();
    $status = $exists ? 'sent' : 'missing';

    return redirect('/password-recovery?status=' . $status . '&email=' . urlencode($data['email']));
});
Route::middleware('auth')->group(function () use ($serve) {
    Route::get('/account/profile', fn () => $serve('account-profile.html'));
    Route::get('/account/settings', fn () => $serve('account-settings.html'));
    Route::get('/account/listings', fn () => $serve('account-listings.html'));
    Route::get('/account/reviews', fn () => $serve('account-reviews.html'));
    Route::get('/account/favorites', fn () => $serve('account-favorites.html'));
    Route::get('/account/payment', fn () => $serve('account-payment.html'));
});

// Dynamic version (kept separately)
Route::prefix('app')->group(function () {
    Route::get('/', [HomeController::class, 'index'])->name('app.home');
    Route::get('/listings', [ListingController::class, 'index'])->name('app.listings.index');
    Route::get('/listings/{module}', [ListingController::class, 'index'])
        ->whereIn('module', ['contractors', 'real-estate', 'cars', 'events', 'restaurants'])
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
