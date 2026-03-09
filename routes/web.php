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
use Illuminate\Validation\Rules\Password;
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
    $accountAuthPage = str_starts_with($file, 'account-') && Auth::check();
    $noFlashPage = $accountAuthPage || str_starts_with($file, 'add-');
    if ($noFlashPage) {
        $noFlashStyles = <<<'HTML'
<style id="account-noflash-style">
.content-wrapper{opacity:0;transition:opacity .12s ease}
body.account-dom-ready .content-wrapper{opacity:1}
</style>
HTML;
        $html = str_replace('</head>', $noFlashStyles . '</head>', $html);
    }
    if (str_starts_with($file, 'add-')) {
        // Keep add flows on native selects to avoid double-rendered dropdown UI.
        $html = preg_replace(
            '~<script\s+src="(?:/finder/)?assets/vendor/choices\.js/public/assets/scripts/choices\.min\.js"></script>\s*~i',
            '',
            $html
        ) ?? $html;
    }
    if (Auth::check()) {
        $authNavScript = <<<'HTML'
<script>
(() => {
  // Signed-in state: remove top Account dropdown completely.
  document.querySelectorAll('.navbar-nav .nav-item.dropdown').forEach((item) => {
    const toggle = item.querySelector(':scope > .nav-link.dropdown-toggle');
    const text = (toggle?.textContent || '').trim().toLowerCase();
    if (text === 'account') item.remove();
  });

  const accountDropdowns = Array.from(document.querySelectorAll('.dropdown-menu'))
    .filter((menu) => Array.from(menu.querySelectorAll('a.dropdown-item')).some((a) => (a.textContent || '').trim() === 'Auth Pages'));

    accountDropdowns.forEach((menu) => {
    const authToggle = Array.from(menu.querySelectorAll('a.dropdown-item')).find((a) => (a.textContent || '').trim() === 'Auth Pages');
    const authLi = authToggle ? authToggle.closest('li') : null;
    if (authLi) authLi.remove();

    const hasProfile = Array.from(menu.querySelectorAll('a.dropdown-item')).some((a) => /my profile/i.test(a.textContent || ''));
    if (!hasProfile) {
      const divider = document.createElement('li');
      divider.innerHTML = '<hr class="dropdown-divider">';
      menu.appendChild(divider);
      menu.insertAdjacentHTML(
        'beforeend',
        '<li><a class="dropdown-item" href="/account/profile">My Profile</a></li>'
      );
    }

    const hasSignOut = Array.from(menu.querySelectorAll('a.dropdown-item')).some((a) => /sign out/i.test(a.textContent || ''));
    if (!hasSignOut) {
      menu.insertAdjacentHTML(
        'beforeend',
        '<li><a class="dropdown-item" href="/signout">Sign out</a></li>'
      );
    }
    });

  // Sidebar / account area: ensure sign-out points to real logout route
  document.querySelectorAll('a.list-group-item, a.dropdown-item, a').forEach((link) => {
    const text = (link.textContent || '').trim().toLowerCase();
    if (text === 'sign out' || text.includes('sign out of all sessions')) {
      link.setAttribute('href', '/signout');
    }
  });
})();
</script>
HTML;
        $html = str_replace('</body>', $authNavScript . '</body>', $html);

        if (str_starts_with($file, 'account-')) {
            $authAvatar = (string) (Auth::user()?->avatar_url ?? '');
            $authAvatarJson = json_encode($authAvatar, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
            $avatarAndDefaultsStripScript = <<<'HTML'
<script>
(() => {
  const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22%3E%3Ccircle cx=%2260%22 cy=%2260%22 r=%2260%22 fill=%22%23e9ecef%22/%3E%3Cpath d=%22M60 62c-14 0-25-11-25-25s11-25 25-25 25 11 25 25-11 25-25 25zm0 8c22 0 40 12 40 28v10H20V98c0-16 18-28 40-28z%22 fill=%22%239aa4b2%22/%3E%3C/svg%3E';
  const authAvatar = __AUTH_AVATAR__;
  const avatar = authAvatar || defaultAvatar;
  document.querySelectorAll('#accountSidebar img, #personal-info img, .offcanvas-body img.rounded-circle, img[src*="/finder/assets/img/account/avatar"], img[src*="/finder/assets/img/avatar"]').forEach((img) => {
    img.src = avatar;
  });

  // If listing image is still template default, replace with neutral placeholder.
  const carTemplateImages = [
    '/finder/assets/img/listings/cars/grid/04.jpg',
    '/finder/assets/img/listings/cars/grid/03.jpg',
    '/finder/assets/img/listings/cars/grid/02.jpg',
    '/finder/assets/img/listings/cars/grid/01.jpg'
  ];
  const neutral = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 427%22%3E%3Crect width=%22640%22 height=%22427%22 fill=%22%23eef2f6%22/%3E%3Cpath d=%22M183 260h274l35 47H148l35-47zm74-57h126l26 39H231l26-39z%22 fill=%22%23c6d0db%22/%3E%3Ccircle cx=%22223%22 cy=%22322%22 r=%2228%22 fill=%22%2398a6b6%22/%3E%3Ccircle cx=%22417%22 cy=%22322%22 r=%2228%22 fill=%22%2398a6b6%22/%3E%3C/svg%3E';
  document.querySelectorAll('article img, .card img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (carTemplateImages.some((p) => src.includes(p))) {
      img.src = neutral;
    }
  });
})();
</script>
HTML;
            $avatarAndDefaultsStripScript = str_replace('__AUTH_AVATAR__', $authAvatarJson ?: "''", $avatarAndDefaultsStripScript);
            $html = str_replace('</body>', $avatarAndDefaultsStripScript . '</body>', $html);
        }
    }
    if (! Auth::check()) {
        $guestNavScript = <<<'HTML'
<script>
(() => {
  const accountDropdowns = Array.from(document.querySelectorAll('.dropdown-menu'))
    .filter((menu) => Array.from(menu.querySelectorAll('a.dropdown-item')).some((a) => (a.textContent || '').trim() === 'Auth Pages'));

  accountDropdowns.forEach((menu) => {
    menu.innerHTML = `
      <li><a class="dropdown-item" href="/signin">Sign In</a></li>
      <li><a class="dropdown-item" href="/signup">Sign Up</a></li>
    `;
  });
})();
</script>
HTML;
        $html = str_replace('</body>', $guestNavScript . '</body>', $html);
    }

    if (str_starts_with($file, 'account-') && Auth::check()) {
        $user = Auth::user();
        $name = htmlspecialchars((string) ($user?->name ?? 'Monaclick User'), ENT_QUOTES, 'UTF-8');
        $email = htmlspecialchars((string) ($user?->email ?? ''), ENT_QUOTES, 'UTF-8');
        $avatarUrl = (string) ($user?->avatar_url ?? '');
        if ($avatarUrl !== '') {
            $avatarEsc = htmlspecialchars($avatarUrl, ENT_QUOTES, 'UTF-8');
            $html = preg_replace(
                '~src="(?:/finder/assets/img/account/avatar(?:-lg)?\.jpg|/finder/assets/img/avatar[^"]*)"~',
                'src="' . $avatarEsc . '"',
                $html
            ) ?? $html;
        }
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
        $userListings = Listing::query()
            ->with('city')
            ->where('user_id', $user?->id)
            ->latest('id')
            ->take(50)
            ->get();
        $hasReviewsTable = DB::getSchemaBuilder()->hasTable('reviews');
        $hasFavoritesTable = DB::getSchemaBuilder()->hasTable('favorites');
        $reviewCount = $hasReviewsTable ? DB::table('reviews')->where('user_id', $user?->id)->count() : 0;
        $favoriteCount = $hasFavoritesTable ? DB::table('favorites')->where('user_id', $user?->id)->count() : 0;
        $isNewUser = $listingCount === 0 && $reviewCount === 0 && $favoriteCount === 0;

        if (in_array($file, ['account-profile.html', 'account-listings.html'], true)) {
            $profileName = trim((string) (($user?->first_name ?? '') . ' ' . ($user?->last_name ?? '')));
            if ($profileName === '') {
                $profileName = (string) ($user?->name ?? 'User');
            }
            $profilePayload = [
                'name' => $profileName,
                'email' => (string) ($user?->email ?? ''),
                'phone' => (string) ($user?->phone ?? ''),
                'address' => (string) ($user?->address ?? ''),
                'bio' => (string) ($user?->bio ?? ''),
                'avatar' => (string) ($user?->avatar_url ?? ''),
            ];
            $listingsPayload = $userListings->map(function (Listing $listing) {
                return [
                    'id' => $listing->id,
                    'title' => (string) $listing->title,
                    'module' => (string) $listing->module,
                    'module_label' => Listing::MODULE_OPTIONS[$listing->module] ?? ucfirst((string) $listing->module),
                    'price' => (string) ($listing->display_price ?: ($listing->price ?? '')),
                    'city' => (string) ($listing->city?->name ?? ''),
                    'image' => (string) $listing->image_url,
                    'status' => (string) $listing->status,
                    'created_at' => optional($listing->created_at)->format('d/m/Y') ?? '',
                ];
            })->values()->all();
            $profileJson = json_encode($profilePayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
            $listingsJson = json_encode($listingsPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);

            $accountListingsSyncScript = <<<'HTML'
<script>
(() => {
  const profile = __USER_PROFILE__;
  const listings = __USER_LISTINGS__;
  if (!Array.isArray(listings) || !profile) return;
  const csrfToken = '__SCRIPT_CSRF__';

  const esc = (v) => String(v || '').replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m
  ));
  const avatar = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22%3E%3Ccircle cx=%2260%22 cy=%2260%22 r=%2260%22 fill=%22%23e9ecef%22/%3E%3Cpath d=%22M60 62c-14 0-25-11-25-25s11-25 25-25 25 11 25 25-11 25-25 25zm0 8c22 0 40 12 40 28v10H20V98c0-16 18-28 40-28z%22 fill=%22%239aa4b2%22/%3E%3C/svg%3E';
  const editHref = (item) => {
    if (item.module === 'cars') return `/sell-car?edit=${encodeURIComponent(item.id)}`;
    if (item.module === 'real-estate') return `/add-property?edit=${encodeURIComponent(item.id)}`;
    if (item.module === 'contractors') return `/add-contractor?edit=${encodeURIComponent(item.id)}`;
    if (item.module === 'restaurants') return `/add-restaurant?edit=${encodeURIComponent(item.id)}`;
    return '';
  };
  const deleteForm = (item) => `
    <form method="post" action="/account/listings/delete" class="d-inline">
      <input type="hidden" name="_token" value="${esc(csrfToken)}">
      <input type="hidden" name="listing_id" value="${esc(item.id)}">
      <button type="submit" class="btn btn-sm btn-outline-danger" onclick="return confirm('Delete this listing?')">Delete</button>
    </form>
  `;

  const card = (item, compact = false) => `
    <article class="card border-0 shadow-sm mb-3">
      <div class="row g-0">
        <div class="${compact ? 'col-sm-4' : 'col-md-4'}">
          <img class="w-100 h-100 object-fit-cover rounded-start" style="min-height: 180px" src="${esc(item.image)}" alt="${esc(item.title)}">
        </div>
        <div class="${compact ? 'col-sm-8' : 'col-md-8'}">
          <div class="card-body d-flex flex-column h-100">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge ${item.status === 'draft' ? 'text-bg-secondary' : 'text-bg-success'}">${esc(item.status)}</span>
              <small class="text-body-secondary">${esc(item.created_at)}</small>
            </div>
            <h3 class="h6 mb-1">${esc(item.title)}</h3>
            <div class="text-body-secondary small mb-2">${esc(item.module_label)}${item.city ? ' • ' + esc(item.city) : ''}</div>
            <div class="fw-semibold mb-3">${esc(item.price || 'Price on request')}</div>
            <div class="mt-auto d-flex gap-2 flex-wrap">
              <a class="btn btn-sm btn-outline-secondary" href="/listings/${encodeURIComponent(item.module)}?q=${encodeURIComponent(item.title)}">View</a>
              ${editHref(item) ? `<a class="btn btn-sm btn-primary" href="${editHref(item)}">Edit</a>` : ''}
              ${deleteForm(item)}
            </div>
          </div>
        </div>
      </div>
    </article>
  `;

  if (location.pathname === '/account/profile') {
    const root = document.querySelector('.col-lg-9');
    if (!root) return;
    root.innerHTML = `
      <h1 class="h2 pb-2 pb-lg-3">My profile</h1>
      <section class="pb-5 mb-md-3">
        <div class="d-flex align-items-start gap-3 mb-4">
          <img src="${avatar}" alt="Avatar" width="96" height="96" class="rounded-circle border">
          <div>
            <h2 class="h4 mb-2">${esc(profile.name)}</h2>
            <div class="text-body-secondary">${esc(profile.email)}</div>
          </div>
        </div>
        <div class="vstack gap-2 fs-5">
          ${profile.phone ? `<div><strong>Phone:</strong> ${esc(profile.phone)}</div>` : ''}
          ${profile.address ? `<div><strong>Address:</strong> ${esc(profile.address)}</div>` : ''}
          ${profile.bio ? `<div><strong>About:</strong> ${esc(profile.bio)}</div>` : ''}
        </div>
      </section>
    `;
  }

  if (location.pathname === '/account/listings') {
    const root = document.querySelector('.col-lg-9');
    if (!root) return;
    root.innerHTML = `
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-2 pb-lg-3">
        <h1 class="h2 mb-0">My listings</h1>
        ${listings.length ? '<a class="btn btn-primary" href="/add-listing">Add new listing</a>' : ''}
      </div>
      ${listings.length ? listings.map((item) => card(item)).join('') : `
        <div class="card border-0 bg-body-tertiary">
          <div class="card-body py-5 text-center">
            <h3 class="h5 mb-2">No listings yet</h3>
            <p class="text-body-secondary mb-4">Your listings will appear here after you publish them.</p>
            <a class="btn btn-primary" href="/add-listing">Add your first listing</a>
          </div>
        </div>
      `}
    `;
  }
})();
</script>
HTML;
            $accountListingsSyncScript = str_replace('__USER_PROFILE__', $profileJson ?: '{}', $accountListingsSyncScript);
            $accountListingsSyncScript = str_replace('__USER_LISTINGS__', $listingsJson ?: '[]', $accountListingsSyncScript);
            $accountListingsSyncScript = str_replace('__SCRIPT_CSRF__', csrf_token(), $accountListingsSyncScript);
            $html = str_replace('</body>', $accountListingsSyncScript . '</body>', $html);
        }

        if ($isNewUser && str_starts_with($file, 'account-')) {
            $emptyAvatarEverywhereScript = <<<'HTML'
<script>
(() => {
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22%3E%3Ccircle cx=%2260%22 cy=%2260%22 r=%2260%22 fill=%22%23e9ecef%22/%3E%3Cpath d=%22M60 62c-14 0-25-11-25-25s11-25 25-25 25 11 25 25-11 25-25 25zm0 8c22 0 40 12 40 28v10H20V98c0-16 18-28 40-28z%22 fill=%22%239aa4b2%22/%3E%3C/svg%3E';
  document.querySelectorAll('img[src*="/finder/assets/img/account/avatar"], img[src*="/finder/assets/img/avatar"]').forEach((img) => {
    img.src = placeholder;
  });
})();
</script>
HTML;
            $html = str_replace('</body>', $emptyAvatarEverywhereScript . '</body>', $html);
        }

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

        }
    }

    if ($file === 'account-signin.html') {
        $signinAuditScript = <<<'HTML'
<script>
(() => {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  const input = document.querySelector('input[type="email"], input[name="email"]');
  if (input && email) input.value = email;
})();
</script>
HTML;
        $html = str_replace('</body>', $signinAuditScript . '</body>', $html);
    }

    if ($file === 'account-signup.html') {
        $signupAuditScript = <<<'HTML'
<script>
(() => {
  const form = document.querySelector('form[action="/signup"]');
  if (!form) return;
  const pass = form.querySelector('input[name="password"]');
  const submit = form.querySelector('button[type="submit"]');
  if (!pass || !submit) return;
  form.addEventListener('submit', (e) => {
    if ((pass.value || '').length < 8) {
      e.preventDefault();
      const old = form.querySelector('.js-signup-error');
      if (old) old.remove();
      form.insertAdjacentHTML('afterbegin', '<div class="alert alert-danger js-signup-error">Password must be at least 8 characters.</div>');
    }
  });
})();
</script>
HTML;
        $html = str_replace('</body>', $signupAuditScript . '</body>', $html);
    }

    if ($file === 'account-password-recovery.html') {
        $recoveryAuditScript = <<<'HTML'
<script>
(() => {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  const input = document.querySelector('input[type="email"], input[name="email"]');
  if (input && email) input.value = email;

  const form = document.querySelector('form[action="/password-recovery"]');
  if (!form) return;
  if (params.get('status') === 'sent') {
    form.insertAdjacentHTML('afterbegin', '<div class="alert alert-success">If this email exists, reset instructions were sent.</div>');
  } else if (params.get('status') === 'missing') {
    form.insertAdjacentHTML('afterbegin', '<div class="alert alert-warning">No account found with this email.</div>');
  }
})();
</script>
HTML;
        $html = str_replace('</body>', $recoveryAuditScript . '</body>', $html);
    }

    if ($file === 'account-settings.html' && Auth::check()) {
        $settingsPayload = [
            'first_name' => (string) (Auth::user()?->first_name ?? ''),
            'last_name' => (string) (Auth::user()?->last_name ?? ''),
            'email' => (string) (Auth::user()?->email ?? ''),
            'phone' => (string) (Auth::user()?->phone ?? ''),
            'birth_date' => (string) (Auth::user()?->birth_date ?? ''),
            'address' => (string) (Auth::user()?->address ?? ''),
            'bio' => (string) (Auth::user()?->bio ?? ''),
            'avatar' => (string) (Auth::user()?->avatar_url ?? ''),
        ];
        $settingsJson = json_encode($settingsPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
        $settingsScript = <<<'HTML'
<script>
(() => {
  const profile = __PROFILE_DATA__ || {};
  const params = new URLSearchParams(window.location.search);
  const csrf = '__SCRIPT_CSRF__';

  const showNotice = (message, type = 'success') => {
    const root = document.querySelector('.col-lg-9');
    if (!root) return;
    const old = root.querySelector('.monaclick-settings-notice');
    if (old) old.remove();
    const note = document.createElement('div');
    note.className = `alert alert-${type} monaclick-settings-notice`;
    note.textContent = message;
    root.prepend(note);
  };

  if (params.get('settings') === 'updated') showNotice('Profile updated successfully.', 'success');
  if (params.get('password') === 'updated') showNotice('Password updated successfully.', 'success');
  if (params.get('error') === 'password') showNotice('Current password is invalid or new password confirmation failed.', 'danger');

  const setVal = (selector, value) => {
    const el = document.querySelector(selector);
    if (el && typeof value === 'string') el.value = value;
  };

  setVal('#fn', profile.first_name || '');
  setVal('#ln', profile.last_name || '');
  setVal('#email', profile.email || '');
  setVal('#phone', profile.phone || '');
  setVal('#birth-date', profile.birth_date || '');
  setVal('#address', profile.address || '');
  setVal('#user-info', profile.bio || '');

  const progressRoot = document.querySelector('#personal-info .card.bg-warning-subtle');
  const progressRing = progressRoot?.querySelector('.circular-progress');
  const progressLabel = progressRing?.querySelector('h5');
  const computeProgress = () => {
    const fields = [
      document.querySelector('#fn'),
      document.querySelector('#ln'),
      document.querySelector('#email'),
      document.querySelector('#phone'),
      document.querySelector('#birth-date'),
      document.querySelector('#address'),
      document.querySelector('#user-info'),
    ].filter(Boolean);
    const total = fields.length || 1;
    const done = fields.filter((el) => String(el.value || '').trim() !== '').length;
    const percent = Math.round((done / total) * 100);
    if (progressRing) {
      progressRing.style.setProperty('--fn-progress', String(percent));
      progressRing.setAttribute('aria-valuenow', String(percent));
    }
    if (progressLabel) progressLabel.textContent = `${percent}%`;
  };
  ['#fn', '#ln', '#email', '#phone', '#birth-date', '#address', '#user-info'].forEach((selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.addEventListener('input', computeProgress);
    el.addEventListener('change', computeProgress);
  });
  computeProgress();

  const securityEmail = document.querySelector('#security p span.fw-medium.text-primary');
  if (securityEmail && profile.email) securityEmail.textContent = profile.email;
  const sidebarName = document.querySelector('#accountSidebar h6.mb-1');
  if (sidebarName) sidebarName.textContent = profile.first_name || profile.last_name
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : (profile.email || 'Monaclick User');
  const sidebarEmail = document.querySelector('#accountSidebar .offcanvas-body .fs-sm');
  if (sidebarEmail && profile.email) sidebarEmail.textContent = profile.email;

  const deviceHistoryHeading = Array.from(document.querySelectorAll('#security h3')).find((h) => (h.textContent || '').trim().toLowerCase() === 'device history');
  if (deviceHistoryHeading) {
    const cardGrid = deviceHistoryHeading.nextElementSibling;
    if (cardGrid) cardGrid.remove();
    const signOutAll = deviceHistoryHeading.nextElementSibling;
    if (signOutAll) signOutAll.remove();
    deviceHistoryHeading.remove();
  }

  const avatarImages = Array.from(document.querySelectorAll('#personal-info img, #accountSidebar img, .offcanvas-body img.rounded-circle, img[alt*="Avatar"], img[alt*="photo"]'))
    .filter((img) => img && img.tagName === 'IMG');
  avatarImages.forEach((img) => {
    if (profile.avatar) img.src = profile.avatar;
  });

  const personalForm = document.querySelector('#personal-info form.needs-validation');
  if (personalForm) {
    personalForm.method = 'post';
    personalForm.action = '/account/settings';
    personalForm.enctype = 'multipart/form-data';

    const ensureHidden = (name, value) => {
      let field = personalForm.querySelector(`input[type="hidden"][name="${name}"]`);
      if (!field) {
        field = document.createElement('input');
        field.type = 'hidden';
        field.name = name;
        personalForm.prepend(field);
      }
      field.value = value;
    };

    ensureHidden('_token', csrf);
    ensureHidden('_method', 'POST');

    const mapName = (selector, name) => {
      const el = personalForm.querySelector(selector);
      if (el) el.name = name;
    };
    mapName('#fn', 'first_name');
    mapName('#ln', 'last_name');
    mapName('#email', 'email');
    mapName('#phone', 'phone');
    mapName('#birth-date', 'birth_date');
    mapName('#address', 'address');
    mapName('#user-info', 'bio');

    let avatarInput = personalForm.querySelector('input[type="file"][name="avatar"]');
    if (!avatarInput) {
      avatarInput = document.createElement('input');
      avatarInput.type = 'file';
      avatarInput.name = 'avatar';
      avatarInput.accept = 'image/*';
      avatarInput.className = 'd-none';
      personalForm.appendChild(avatarInput);
    }

    const updatePhotoBtn = Array.from(document.querySelectorAll('#personal-info button, #personal-info a'))
      .find((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'update photo');
    if (updatePhotoBtn) {
      updatePhotoBtn.addEventListener('click', (event) => {
        event.preventDefault();
        avatarInput.click();
      });
      avatarInput.addEventListener('change', () => {
        const file = avatarInput.files && avatarInput.files[0];
        if (!file) return;
        const src = URL.createObjectURL(file);
        avatarImages.forEach((img) => { img.src = src; });
        const fd = new FormData();
        fd.append('_token', csrf);
        fd.append('avatar', file);
        fetch('/account/avatar', { method: 'POST', body: fd, credentials: 'same-origin' })
          .then((r) => r.ok ? r.json() : Promise.reject(new Error('upload failed')))
          .then((res) => {
            if (res && res.avatar_url) {
              avatarImages.forEach((img) => { img.src = res.avatar_url; });
            }
            showNotice('Profile photo updated successfully.', 'success');
          })
          .catch(() => {
            showNotice('Photo upload failed. Please try again.', 'danger');
          });
      });
    }
  }

  const passwordForm = document.querySelector('#security form.needs-validation');
  if (passwordForm) {
    passwordForm.method = 'post';
    passwordForm.action = '/account/password';
    const ensureHidden = (name, value) => {
      let field = passwordForm.querySelector(`input[type="hidden"][name="${name}"]`);
      if (!field) {
        field = document.createElement('input');
        field.type = 'hidden';
        field.name = name;
        passwordForm.prepend(field);
      }
      field.value = value;
    };
    ensureHidden('_token', csrf);
    ensureHidden('_method', 'POST');

    const current = passwordForm.querySelector('#current-password');
    const next = passwordForm.querySelector('#new-password');
    const confirm = passwordForm.querySelector('#confirm-new-password');
    if (current) current.name = 'current_password';
    if (next) next.name = 'password';
    if (confirm) confirm.name = 'password_confirmation';
  }
})();
</script>
HTML;
        $settingsScript = str_replace('__PROFILE_DATA__', $settingsJson ?: '{}', $settingsScript);
        $settingsScript = str_replace('__SCRIPT_CSRF__', csrf_token(), $settingsScript);
        $html = str_replace('</body>', $settingsScript . '</body>', $html);
    }

    if ($file === 'account-reviews.html') {
        $forceEmptyReviewsScript = <<<'HTML'
<script>
(() => {
  const root = document.querySelector('.col-lg-9');
  if (!root) return;
  root.innerHTML = `
    <h1 class="h2 pb-2 pb-lg-3">Reviews</h1>
    <div class="card border-0 bg-body-tertiary">
      <div class="card-body py-5 text-center">
        <h3 class="h5 mb-2">No reviews yet</h3>
        <p class="text-body-secondary mb-0">Reviews will appear here when available.</p>
      </div>
    </div>
  `;
})();
</script>
HTML;
        $html = str_replace('</body>', $forceEmptyReviewsScript . '</body>', $html);
    }

    if ($file === 'account-favorites.html') {
        $forceEmptyFavoritesScript = <<<'HTML'
<script>
(() => {
  const root = document.querySelector('.col-lg-9');
  if (!root) return;
  root.innerHTML = `
    <h1 class="h2 pb-2 pb-lg-3">Favorites</h1>
    <div class="card border-0 bg-body-tertiary">
      <div class="card-body py-5 text-center">
        <h3 class="h5 mb-2">No favorites yet</h3>
        <p class="text-body-secondary mb-4">Save listings to see them here.</p>
        <a class="btn btn-primary" href="/listings">Browse listings</a>
      </div>
    </div>
  `;
})();
</script>
HTML;
        $html = str_replace('</body>', $forceEmptyFavoritesScript . '</body>', $html);
    }

    if ($file === 'add-property-type.html') {
        $propertyEditPayload = null;
        $editId = (int) request()->query('edit', 0);
        if ($editId > 0) {
            $editQuery = Listing::query()
                ->with(['propertyDetail', 'city', 'category'])
                ->where('id', $editId)
                ->where('module', 'real-estate');
            if (Auth::check()) {
                $editQuery->where('user_id', Auth::id());
            }
            $editListing = $editQuery->first();
            if ($editListing) {
                $propertyEditPayload = [
                    'id' => $editListing->id,
                    'title' => (string) $editListing->title,
                    'listing_type' => (string) ($editListing->propertyDetail?->listing_type ?? 'sale'),
                    'property_type' => (string) ($editListing->propertyDetail?->property_type ?? ''),
                ];
            }
        }
        $propertyEditJson = json_encode($propertyEditPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
        $propertyScript = <<<'HTML'
<script>
(() => {
  const editData = __PROPERTY_EDIT_DATA__;
  const isEdit = !!(editData && editData.id);
  let isSubmitting = false;
  const wizardKey = 'propertyWizardSession';
  const ensureWizardSession = () => {
    try {
      let value = localStorage.getItem(wizardKey);
      if (!value) {
        value = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(wizardKey, value);
      }
      return value;
    } catch (_) {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  };
  const heading = document.querySelector('h1.h2');
  if (isEdit && heading) heading.textContent = 'Edit property';

  const getCheckedLabel = (name) => {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    if (!checked) return '';
    const label = document.querySelector(`label[for="${checked.id}"]`);
    return (label?.textContent || '').trim();
  };
  const setCheckedByName = (name, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const submitPayload = (isDraft, nextPath = '') => {
    if (isSubmitting) return;
    isSubmitting = true;
    const payload = {
      'radio:category': getCheckedLabel('category').toLowerCase().includes('rent') ? 'rent' : 'sell',
      'radio:type': getCheckedLabel('type') || 'House',
      'radio:condition': getCheckedLabel('condition') || 'Secondary market',
      'wizard_session': ensureWizardSession()
    };
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/submit/property';
    form.innerHTML = `
      <input type="hidden" name="_token" value="__SCRIPT_CSRF__">
      <input type="hidden" name="payload" value="${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}">
      ${isDraft ? '<input type="hidden" name="draft" value="1">' : ''}
      ${isEdit ? `<input type="hidden" name="listing_id" value="${String(editData.id)}">` : ''}
      ${nextPath ? `<input type="hidden" name="next" value="${nextPath}">` : ''}
    `;
    document.body.appendChild(form);
    form.submit();
  };

  const actionsBar = document.querySelector('.pt-5.d-flex.flex-wrap.gap-3.align-items-center');
  if (actionsBar) actionsBar.classList.add('justify-content-start');
  const draftBtn = document.querySelector('.pt-5 .btn.btn-lg.btn-outline-secondary');
  const nextStepBtn = document.querySelector('.pt-5 .btn.btn-lg.btn-dark');
  if (draftBtn) {
    draftBtn.type = 'button';
    draftBtn.addEventListener('click', () => submitPayload(true));
  }
  if (nextStepBtn) {
    nextStepBtn.setAttribute('href', '#');
    nextStepBtn.addEventListener('click', (event) => {
      event.preventDefault();
      submitPayload(true, '/add-property-location');
    });
  }
  if (isEdit) {
    if ((editData.listing_type || '').toLowerCase() === 'rent') setCheckedByName('category', 'rent');
    else setCheckedByName('category', 'sell');
    if ((editData.property_type || '').toLowerCase() === 'commercial') setCheckedByName('type', 'commercial');
    else setCheckedByName('type', 'house');

    const actions = document.querySelector('.pt-5.d-flex.flex-wrap.gap-3.align-items-center');
    if (actions) {
      const delForm = document.createElement('form');
      delForm.method = 'post';
      delForm.action = '/account/listings/delete';
      delForm.innerHTML = `
        <input type="hidden" name="_token" value="__SCRIPT_CSRF__">
        <input type="hidden" name="listing_id" value="${String(editData.id)}">
        <button type="submit" class="btn btn-lg btn-outline-danger">Delete listing</button>
      `;
      delForm.addEventListener('submit', (event) => {
        if (!window.confirm('Delete this listing?')) event.preventDefault();
      });
      actions.appendChild(delForm);
    }
  }
})();
</script>
HTML;
        $propertyScript = str_replace('__PROPERTY_EDIT_DATA__', $propertyEditJson ?: 'null', $propertyScript);
        $propertyScript = str_replace('__SCRIPT_CSRF__', csrf_token(), $propertyScript);
        $html = str_replace('</body>', $propertyScript . '</body>', $html);
    }

    if (str_starts_with($file, 'add-property-')) {
        $propertyEditPayload = null;
        $editId = (int) request()->query('edit', 0);
        if ($editId > 0) {
            $editQuery = Listing::query()
                ->with(['propertyDetail', 'city', 'category', 'images'])
                ->where('id', $editId)
                ->where('module', 'real-estate');
            if (Auth::check()) {
                $editQuery->where('user_id', Auth::id());
            }
            $editListing = $editQuery->first();
            if ($editListing) {
                $propertyEditPayload = [
                    'id' => $editListing->id,
                    'title' => (string) $editListing->title,
                    'listing_type' => (string) ($editListing->propertyDetail?->listing_type ?? 'sale'),
                    'property_type' => (string) ($editListing->propertyDetail?->property_type ?? ''),
                    'wizard_data' => $editListing->propertyDetail?->wizard_data ?? [],
                    'images' => $editListing->images->map(fn ($img) => (string) $img->image_url)->values()->all(),
                ];
            }
        }
        $propertyEditJson = json_encode($propertyEditPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
        $propertyNavScript = <<<'HTML'
<script>
(() => {
  const editData = __PROPERTY_EDIT_DATA__ || null;
  const wizard = (editData && editData.wizard_data && typeof editData.wizard_data === 'object') ? editData.wizard_data : {};
  let isSubmitting = false;
  const wizardKey = 'propertyWizardSession';
  const ensureWizardSession = () => {
    try {
      let value = localStorage.getItem(wizardKey);
      if (!value) {
        value = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(wizardKey, value);
      }
      return value;
    } catch (_) {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  };
  const stepMap = [
    { key: 'property type', url: '/add-property' },
    { key: 'location', url: '/add-property-location' },
    { key: 'photos and videos', url: '/add-property-photos' },
    { key: 'property details', url: '/add-property-details' },
    { key: 'price', url: '/add-property-price' },
    { key: 'contact info', url: '/add-property-contact-info' }
  ];
  const search = new URLSearchParams(window.location.search);
  const editId = (search.get('edit') || (editData?.id ? String(editData.id) : '')).trim();
  if (editId) {
    try { localStorage.setItem(wizardKey, String(editId)); } catch (_) {}
  }
  window.__propertyEditData = editData;
  const withEdit = (url) => (editId ? `${url}?edit=${encodeURIComponent(editId)}` : url);

  // Sidebar steps: allow random step navigation on click.
  const sidebarLinks = Array.from(document.querySelectorAll('.col-lg-3 .nav.flex-lg-column .nav-link'));
  sidebarLinks.forEach((link) => {
    const text = (link.textContent || '').trim().toLowerCase();
    const step = stepMap.find((s) => text.includes(s.key));
    if (!step) return;
    link.classList.remove('disabled', 'pe-none');
    link.removeAttribute('aria-disabled');
    link.setAttribute('href', withEdit(step.url));
  });

  // Normalize next-step buttons that still point to *.html.
  document.querySelectorAll('a.btn.btn-lg.btn-dark[href]').forEach((btn) => {
    const href = (btn.getAttribute('href') || '').trim();
    const m = href.match(/^add-property-([a-z-]+)\.html$/i);
    if (!m) return;
    btn.setAttribute('href', withEdit(`/add-property-${m[1].toLowerCase()}`));
  });

  // New listing mode: clear template demo defaults so user starts with empty data.
  if (!editId) {
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea').forEach((el) => {
      el.value = '';
    });
    document.querySelectorAll('select').forEach((select) => {
      select.selectedIndex = 0;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((el) => {
      el.checked = false;
    });
  }

  const setInput = (id, value) => {
    const el = document.getElementById(id);
    if (!el || typeof value === 'undefined' || value === null) return;
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const setSelectByValue = (ariaLabel, value) => {
    if (!value) return;
    const select = document.querySelector(`select[aria-label="${ariaLabel}"]`);
    if (!select) return;
    const wanted = String(value).trim().toLowerCase();
    let option = Array.from(select.options).find((o) => (o.value || o.textContent || '').trim().toLowerCase() === wanted);
    if (!option) {
      option = document.createElement('option');
      option.value = String(value);
      option.textContent = String(value);
      select.appendChild(option);
    }
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const setChecked = (id, checked = true) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = !!checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const selectedId = (name) => document.querySelector(`input[name="${name}"]:checked`)?.id || '';

  if (editId) {
    const path = window.location.pathname;
    if (path === '/add-property-location') {
      setSelectByValue('Country select', wizard.country);
      setSelectByValue('City select', wizard.city);
      setSelectByValue('District select', wizard.district);
      setInput('zip', wizard.zip);
      setInput('address', wizard.address);
    }
    if (path === '/add-property-details') {
      if (wizard.ownership) setChecked(String(wizard.ownership));
      setInput('floors-total', wizard.floors_total);
      setInput('floor', wizard.floor);
      setInput('total-area', wizard.total_area);
      setInput('living-area', wizard.living_area);
      setInput('kitchen-area', wizard.kitchen_area);
      if (wizard.bedrooms) setChecked(`bedrooms-${wizard.bedrooms}`);
      if (wizard.bathrooms) setChecked(`bathrooms-${wizard.bathrooms}`);
      if (wizard.parking) setChecked(`parking-${wizard.parking}`);
    }
    if (path === '/add-property-price') {
      setInput('price', wizard.price);
      setChecked('negotiated', !!wizard.negotiated);
      setChecked('private', (wizard.offer_type || 'private') === 'private');
      setChecked('agent', (wizard.offer_type || '') === 'agent');
      setChecked('no-credit', !!wizard.no_credit);
      setChecked('ready-agents', !!wizard.ready_agents);
      setChecked('exchange', !!wizard.exchange);
    }
    if (path === '/add-property-contact-info') {
      setInput('fn', wizard.fn);
      setInput('ln', wizard.ln);
      setInput('email', wizard.email);
      setInput('phone', wizard.phone);
      setChecked('tour', !!wizard.tour);
    }
  }

  const buildPayloadForStep = () => {
    const path = window.location.pathname;
    if (path === '/add-property-location') {
      return {
        wizard_session: ensureWizardSession(),
        country: document.querySelector('select[aria-label="Country select"]')?.value || '',
        city: document.querySelector('select[aria-label="City select"]')?.value || '',
        district: document.querySelector('select[aria-label="District select"]')?.value || '',
        zip: document.getElementById('zip')?.value || '',
        address: document.getElementById('address')?.value || '',
        'select:city-select': document.querySelector('select[aria-label="City select"]')?.value || '',
      };
    }
    if (path === '/add-property-details') {
      return {
        wizard_session: ensureWizardSession(),
        ownership: selectedId('ownership'),
        floors_total: document.getElementById('floors-total')?.value || '',
        floor: document.getElementById('floor')?.value || '',
        total_area: document.getElementById('total-area')?.value || '',
        living_area: document.getElementById('living-area')?.value || '',
        kitchen_area: document.getElementById('kitchen-area')?.value || '',
        'total-area': document.getElementById('total-area')?.value || '',
        'radio:bedrooms': selectedId('bedrooms').replace('bedrooms-', ''),
        'radio:bathrooms': selectedId('bathrooms').replace('bathrooms-', ''),
        parking: selectedId('parking').replace('parking-', ''),
      };
    }
    if (path === '/add-property-price') {
      return {
        wizard_session: ensureWizardSession(),
        price: document.getElementById('price')?.value || '',
        negotiated: !!document.getElementById('negotiated')?.checked,
        offer_type: document.getElementById('agent')?.checked ? 'agent' : 'private',
        no_credit: !!document.getElementById('no-credit')?.checked,
        ready_agents: !!document.getElementById('ready-agents')?.checked,
        exchange: !!document.getElementById('exchange')?.checked,
      };
    }
    if (path === '/add-property-contact-info') {
      return {
        wizard_session: ensureWizardSession(),
        fn: document.getElementById('fn')?.value || '',
        ln: document.getElementById('ln')?.value || '',
        email: document.getElementById('email')?.value || '',
        phone: document.getElementById('phone')?.value || '',
        tour: !!document.getElementById('tour')?.checked,
      };
    }
    if (path === '/add-property-photos') {
      return {
        wizard_session: ensureWizardSession(),
        video_link: document.getElementById('link')?.value || '',
      };
    }
    return {};
  };

  const setActionsSubmitting = () => {
    document.querySelectorAll('.pt-5.d-flex.flex-wrap.gap-3.align-items-center .btn').forEach((btn) => {
      btn.classList.add('disabled');
      btn.setAttribute('aria-disabled', 'true');
      if (btn.tagName === 'BUTTON') btn.disabled = true;
    });
  };

  const submitStep = (nextPath = '', publishNow = false) => {
    if (isSubmitting) return;
    isSubmitting = true;
    setActionsSubmitting();
    const payload = buildPayloadForStep();
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/submit/property';
    form.enctype = 'multipart/form-data';
    form.innerHTML = `
      <input type="hidden" name="_token" value="__SCRIPT_CSRF__">
      ${publishNow ? '' : '<input type="hidden" name="draft" value="1">'}
      <input type="hidden" name="payload" value="${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}">
      ${editId ? `<input type="hidden" name="listing_id" value="${editId}">` : ''}
      ${nextPath ? `<input type="hidden" name="next" value="${nextPath}">` : ''}
    `;
    const photoInput = window.__propertyPhotoInput;
    if (photoInput && photoInput.files && photoInput.files.length) {
      photoInput.name = 'photos[]';
      photoInput.multiple = true;
      form.appendChild(photoInput);
    }
    document.body.appendChild(form);
    form.submit();
  };

  // Contact info should only move to ad promotion step.
  if (window.location.pathname === '/add-property-contact-info') {
    const actions = document.querySelector('.pt-5.d-flex.flex-wrap.gap-3.align-items-center');
    if (actions) actions.classList.add('justify-content-start');
    const nextBtn = actions?.querySelector('a.btn.btn-lg.btn-dark');
    if (actions && !actions.querySelector('button[data-property-publish]')) {
      const publishBtn = document.createElement('button');
      publishBtn.type = 'button';
      publishBtn.className = 'btn btn-lg btn-primary';
      publishBtn.textContent = 'Publish listing';
      publishBtn.setAttribute('data-property-publish', '1');
      publishBtn.addEventListener('click', (event) => {
        event.preventDefault();
        submitStep('', true);
      });
      actions.appendChild(publishBtn);
    }
    if (nextBtn) {
      nextBtn.textContent = 'Go to ad promotion';
      nextBtn.setAttribute('href', '#');
      nextBtn.addEventListener('click', (event) => {
        event.preventDefault();
        submitStep('/add-property-promotion');
      });
    }
  }

  const nextMap = {
    '/add-property-location': '/add-property-photos',
    '/add-property-photos': '/add-property-details',
    '/add-property-details': '/add-property-price',
    '/add-property-price': '/add-property-contact-info',
  };
  const path = window.location.pathname;
  if (nextMap[path]) {
    const actions = document.querySelector('.pt-5.d-flex.flex-wrap.gap-3.align-items-center');
    if (actions) actions.classList.add('justify-content-start');
    const draftBtn = actions?.querySelector('button.btn.btn-lg.btn-outline-secondary');
    const nextBtn = actions?.querySelector('a.btn.btn-lg.btn-dark');
    if (draftBtn) {
      if (!draftBtn.dataset.propertyBound) {
        draftBtn.dataset.propertyBound = '1';
        draftBtn.addEventListener('click', (event) => {
          event.preventDefault();
          submitStep('');
        });
      }
    }
    if (nextBtn) {
      nextBtn.setAttribute('href', '#');
      if (!nextBtn.dataset.propertyBound) {
        nextBtn.dataset.propertyBound = '1';
        nextBtn.addEventListener('click', (event) => {
          event.preventDefault();
          submitStep(nextMap[path]);
        });
      }
    }
  }
})();
</script>
HTML;
        $propertyNavScript = str_replace('__PROPERTY_EDIT_DATA__', $propertyEditJson ?: 'null', $propertyNavScript);
        $propertyNavScript = str_replace('__SCRIPT_CSRF__', csrf_token(), $propertyNavScript);
        $html = str_replace('</body>', $propertyNavScript . '</body>', $html);
    }

    if (str_starts_with($file, 'add-contractor-')) {
        $contractorCsrfScript = <<<'HTML'
<script>
window.__mcCsrf = '__SCRIPT_CSRF__';
</script>
HTML;
        $contractorCsrfScript = str_replace('__SCRIPT_CSRF__', csrf_token(), $contractorCsrfScript);
        $html = str_replace('</body>', $contractorCsrfScript . '</body>', $html);
    }

    if ($file === 'add-property-photos.html') {
        $propertyPhotosScript = <<<'HTML'
<script>
(() => {
  const grid = document.querySelector('.row.row-cols-2.row-cols-sm-3');
  if (!grid) return;
  const editData = window.__propertyEditData || null;
  const existingImages = Array.isArray(editData?.images) ? editData.images : [];
  let nextFileId = 1;
  const selectedFiles = [];
  const syncInputFiles = () => {
    const dt = new DataTransfer();
    selectedFiles.forEach((row) => {
      if (row?.file) dt.items.add(row.file);
    });
    input.files = dt.files;
  };

  let uploadCol = Array.from(grid.children).find((col) =>
    (col.textContent || '').toLowerCase().includes('upload photos / videos')
  );
  if (!uploadCol) return;

  // Hard reset upload tile to remove any previously bound listeners from static assets.
  const freshUploadCol = uploadCol.cloneNode(true);
  uploadCol.parentNode?.replaceChild(freshUploadCol, uploadCol);
  uploadCol = freshUploadCol;
  uploadCol.querySelectorAll('input[type="file"]').forEach((el) => el.remove());

  // Remove template default photos; keep only upload tile.
  Array.from(grid.children).forEach((col) => {
    if (col !== uploadCol) col.remove();
  });

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.multiple = true;
  input.className = 'position-absolute top-0 start-0 w-100 h-100 opacity-0';
  input.style.zIndex = '5';
  input.style.cursor = 'pointer';
  input.name = 'photos[]';
  const uploadTile = uploadCol.querySelector('.d-flex.align-items-center.justify-content-center.position-relative.h-100.cursor-pointer') || uploadCol;
  uploadTile.appendChild(input);
  window.__propertyPhotoInput = input;

  const linkInput = document.getElementById('link');
  const linkWrap = linkInput ? (linkInput.closest('.pt-3.mt-3') || linkInput.closest('div')) : null;
  if (linkWrap) linkWrap.remove();

  input.addEventListener('click', () => {
    input.value = '';
  });

  const makeCard = (src, isVideo, fileId = null) => {
    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = `
      <div class="hover-effect-opacity position-relative overflow-hidden rounded">
        <div class="ratio" style="--fn-aspect-ratio: calc(180 / 268 * 100%)">
          ${isVideo
            ? `<video src="${src}" class="w-100 h-100 object-fit-cover" muted controls></video>`
            : `<img src="${src}" alt="Uploaded image" class="w-100 h-100 object-fit-cover">`}
        </div>
        <div class="hover-effect-target position-absolute top-0 start-0 d-flex align-items-center justify-content-center w-100 h-100 opacity-0">
          <button type="button" class="btn btn-icon btn-sm btn-light position-relative z-2" aria-label="Remove">
            <i class="fi-trash fs-base"></i>
          </button>
          <span class="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-25 z-1"></span>
        </div>
      </div>
    `;
    const removeBtn = col.querySelector('button[aria-label="Remove"]');
    removeBtn?.addEventListener('click', () => {
      if (fileId !== null) {
        const idx = selectedFiles.findIndex((row) => row.id === fileId);
        if (idx >= 0) selectedFiles.splice(idx, 1);
        syncInputFiles();
      }
      col.remove();
    });
    return col;
  };

  // Existing static delete buttons.
  grid.querySelectorAll('button[aria-label="Remove"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const col = btn.closest('.col');
      if (col && col !== uploadCol) col.remove();
    });
  });

  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    files.forEach((file) => {
      const id = nextFileId++;
      selectedFiles.push({ id, file });
      const src = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      const card = makeCard(src, isVideo, id);
      grid.insertBefore(card, uploadCol);
    });
    syncInputFiles();
  });

  // Editing: show existing saved images first.
  existingImages.forEach((src, idx) => {
    const isVideo = /\.(mp4|mov|webm)$/i.test(String(src || ''));
    const card = makeCard(String(src || ''), isVideo);
    const badge = card.querySelector('.badge');
    if (idx === 0 && !badge) {
      const span = document.createElement('span');
      span.className = 'badge text-bg-light position-absolute top-0 start-0 z-3 mt-2 ms-2';
      span.textContent = 'Cover';
      card.querySelector('.hover-effect-opacity')?.prepend(span);
    }
    grid.insertBefore(card, uploadCol);
  });
})();
</script>
HTML;
        $html = str_replace('</body>', $propertyPhotosScript . '</body>', $html);
    }

    if ($file === 'add-property-promotion.html') {
        $propertyPromotionScript = <<<'HTML'
<script>
(() => {
  const search = new URLSearchParams(window.location.search);
  const editId = (search.get('edit') || '').trim();

  const publishBtn = Array.from(document.querySelectorAll('a.btn.btn-lg.btn-primary[href]'))
    .find((btn) => (btn.textContent || '').trim().toLowerCase().includes('publish property listing'));
  if (publishBtn) {
    publishBtn.setAttribute('href', '#');
    publishBtn.addEventListener('click', (event) => {
      event.preventDefault();
      if (!editId) {
        window.location.href = '/account/listings';
        return;
      }
      const form = document.createElement('form');
      form.method = 'post';
      form.action = '/account/listings/publish';
      form.innerHTML = `
        <input type="hidden" name="_token" value="__SCRIPT_CSRF__">
        <input type="hidden" name="listing_id" value="${editId}">
      `;
      document.body.appendChild(form);
      form.submit();
    });
  }
})();
</script>
HTML;
        $propertyPromotionScript = str_replace('__SCRIPT_CSRF__', csrf_token(), $propertyPromotionScript);
        $html = str_replace('</body>', $propertyPromotionScript . '</body>', $html);
    }

    if ($file === 'add-contractor-location.html') {
        $contractorEditPayload = null;
        $editId = (int) request()->query('edit', 0);
        if ($editId > 0) {
            $editQuery = Listing::query()
                ->with(['contractorDetail', 'city', 'category'])
                ->where('id', $editId)
                ->where('module', 'contractors');
            if (Auth::check()) {
                $editQuery->where('user_id', Auth::id());
            }
            $editListing = $editQuery->first();
            if ($editListing) {
                $contractorEditPayload = [
                    'id' => $editListing->id,
                    'title' => (string) $editListing->title,
                    'city' => (string) ($editListing->city?->name ?? ''),
                    'service_area' => (string) ($editListing->contractorDetail?->service_area ?? ''),
                ];
            }
        }
        $contractorEditJson = json_encode($contractorEditPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
        $contractorScript = <<<'HTML'
<script>
(() => {
  const editData = __CONTRACTOR_EDIT_DATA__;
  const isEdit = !!(editData && editData.id);
  const heading = document.querySelector('h1.h3');
  if (isEdit && heading) heading.textContent = 'Edit contractor location';

  const selectedText = (selector) => {
    const select = document.querySelector(selector);
    if (!select) return '';
    const option = select.options?.[select.selectedIndex];
    return (option?.textContent || '').trim();
  };
  const getSelectedAreas = () => {
    const chipsWrap = Array.from(document.querySelectorAll('div.d-flex.flex-wrap.gap-2'))
      .find((el) => el.querySelector('button.btn.btn-sm.btn-outline-secondary'));
    if (!chipsWrap) return [];
    return Array.from(chipsWrap.querySelectorAll('button.btn.btn-sm.btn-outline-secondary'))
      .map((btn) => (btn.textContent || '').replace(/\s+/g, ' ').trim().replace(/^x\s*/i, ''))
      .filter(Boolean);
  };
  const bindAreaChips = () => {
    const input = document.getElementById('area-search');
    if (!input) return;
    input.setAttribute('type', 'text');
    const chipsWrap = Array.from(document.querySelectorAll('div.d-flex.flex-wrap.gap-2'))
      .find((el) => el.querySelector('button.btn.btn-sm.btn-outline-secondary'));
    if (!chipsWrap) return;

    const chipValues = () => getSelectedAreas().map((v) => v.toLowerCase());
    const addChip = (label) => {
      const clean = String(label || '').trim();
      if (!clean) return;
      if (chipValues().includes(clean.toLowerCase())) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-outline-secondary rounded-pill';
      btn.innerHTML = `<i class="fi-close fs-sm ms-n1 me-1"></i>${clean}`;
      chipsWrap.appendChild(btn);
    };
    const removeChip = (btn) => {
      if (btn && btn.parentElement === chipsWrap) btn.remove();
    };

    chipsWrap.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest('button.btn.btn-sm.btn-outline-secondary');
      if (!btn) return;
      event.preventDefault();
      removeChip(btn);
    });

    const consumeInput = () => {
      const raw = input.value || '';
      raw.split(',').map((v) => v.trim()).filter(Boolean).forEach(addChip);
      input.value = '';
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        consumeInput();
      }
    });
    input.addEventListener('blur', consumeInput);
  };
  const setSelectByText = (selector, value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return;
    const select = document.querySelector(selector);
    if (!select) return;
    let option = Array.from(select.options).find((opt) => (opt.textContent || '').trim().toLowerCase() === normalized);
    if (!option) {
      option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const submitPayload = (isDraft) => {
    const payload = {
      'select:city-select': selectedText('select[aria-label="City select"]'),
      'address': document.getElementById('address')?.value || '',
      'zip': document.getElementById('zip')?.value || '',
      'area-search': getSelectedAreas().join(', ')
    };
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/submit/contractor';
    form.innerHTML = `
      <input type="hidden" name="_token" value="__SCRIPT_CSRF__">
      <input type="hidden" name="payload" value="${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}">
      ${isDraft ? '<input type="hidden" name="draft" value="1">' : ''}
      ${isEdit ? `<input type="hidden" name="listing_id" value="${String(editData.id)}">` : ''}
    `;
    document.body.appendChild(form);
    form.submit();
  };

  const draftBtn = document.querySelector('.pt-5 .btn.btn-lg.btn-outline-secondary');
  const nextStepBtn = document.querySelector('.pt-5 .btn.btn-lg.btn-dark');
  if (draftBtn) {
    draftBtn.type = 'button';
    draftBtn.addEventListener('click', () => submitPayload(true));
  }
  if (nextStepBtn) {
    const qs = isEdit ? `?edit=${encodeURIComponent(String(editData.id))}` : '';
    nextStepBtn.setAttribute('href', `/add-contractor-services${qs}`);
  }

  bindAreaChips();

  if (isEdit) {
    setSelectByText('select[aria-label="City select"]', editData.city);
    if (editData.service_area) {
      const input = document.getElementById('area-search');
      if (input) {
        input.value = editData.service_area;
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }
    const actions = document.querySelector('.pt-5.d-flex.flex-wrap.gap-3.align-items-center');
    if (actions) {
      const delForm = document.createElement('form');
      delForm.method = 'post';
      delForm.action = '/account/listings/delete';
      delForm.innerHTML = `
        <input type="hidden" name="_token" value="__SCRIPT_CSRF__">
        <input type="hidden" name="listing_id" value="${String(editData.id)}">
        <button type="submit" class="btn btn-lg btn-outline-danger">Delete listing</button>
      `;
      delForm.addEventListener('submit', (event) => {
        if (!window.confirm('Delete this listing?')) event.preventDefault();
      });
      actions.appendChild(delForm);
    }
  }
})();
</script>
HTML;
        $contractorScript = str_replace('__CONTRACTOR_EDIT_DATA__', $contractorEditJson ?: 'null', $contractorScript);
        $contractorScript = str_replace('__SCRIPT_CSRF__', csrf_token(), $contractorScript);
        $html = str_replace('</body>', $contractorScript . '</body>', $html);
    }

    if ($file === 'add-restaurant.html') {
        $restaurantEditPayload = null;
        $editId = (int) request()->query('edit', 0);
        if ($editId > 0) {
            $editQuery = Listing::query()
                ->with(['city', 'category', 'images'])
                ->where('id', $editId)
                ->where('module', 'restaurants');
            if (Auth::check()) {
                $editQuery->where('user_id', Auth::id());
            }
            $editListing = $editQuery->first();
            if ($editListing) {
                $meta = [];
                $excerptRaw = (string) ($editListing->excerpt ?? '');
                if ($excerptRaw !== '') {
                    $decodedMeta = json_decode($excerptRaw, true);
                    if (is_array($decodedMeta) && ($decodedMeta['_mc_restaurant_v1'] ?? false)) {
                        $meta = $decodedMeta;
                    }
                }
                $restaurantEditPayload = [
                    'id' => $editListing->id,
                    'title' => (string) $editListing->title,
                    'city' => (string) ($editListing->city?->name ?? ''),
                    'cuisine_type' => (string) ($editListing->category?->name ?? ''),
                    'price_range' => (string) $editListing->price,
                    'address' => (string) ($meta['address'] ?? ''),
                    'zip_code' => (string) ($meta['zip_code'] ?? ''),
                    'country' => (string) ($meta['country'] ?? ''),
                    'seating_capacity' => (string) ($meta['seating_capacity'] ?? ''),
                    'services' => array_values((array) ($meta['services'] ?? [])),
                    'opening_hours' => (array) ($meta['opening_hours'] ?? []),
                    'contact_name' => (string) ($meta['contact_name'] ?? ''),
                    'phone' => (string) ($meta['phone'] ?? ''),
                    'email' => (string) ($meta['email'] ?? ''),
                    'image' => (string) $editListing->image_url,
                    'gallery_images' => $editListing->images
                        ->sortBy('sort_order')
                        ->values()
                        ->map(fn ($img) => (string) $img->image_url)
                        ->all(),
                ];
            }
        }
        $restaurantEditJson = json_encode($restaurantEditPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
        $restaurantScript = <<<'HTML'
<script>
(() => {
  const form = document.querySelector('form.card');
  if (!form) return;
  const editData = __RESTAURANT_EDIT_DATA__;
  const isEdit = !!(editData && editData.id);

  form.method = 'post';
  form.action = '/submit/restaurant';
  form.enctype = 'multipart/form-data';

  const csrf = document.createElement('input');
  csrf.type = 'hidden';
  csrf.name = '_token';
  csrf.value = '__SCRIPT_CSRF__';
  form.prepend(csrf);

  if (isEdit) {
    const idInput = document.createElement('input');
    idInput.type = 'hidden';
    idInput.name = 'listing_id';
    idInput.value = String(editData.id);
    form.prepend(idInput);
    const h1 = document.querySelector('h1.display-6');
    if (h1) h1.textContent = 'Edit Restaurant';
  }

  const saveDraftBtn = Array.from(form.querySelectorAll('button')).find((btn) => (btn.textContent || '').toLowerCase().includes('save draft'));
  if (saveDraftBtn) {
    saveDraftBtn.type = 'submit';
    saveDraftBtn.name = 'draft';
    saveDraftBtn.value = '1';
  }

  form.querySelectorAll('input[name="services"]').forEach((el) => {
    el.setAttribute('name', 'services[]');
    if (!el.value || el.value === 'on') el.value = String(el.id || '').trim();
  });

  const openingHoursHidden = document.getElementById('openingHoursHidden');
  const dayKeys = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const syncOpeningHours = () => {
    if (!openingHoursHidden) return;
    const payload = {};
    dayKeys.forEach((day) => {
      const enabled = !!document.getElementById(day)?.checked;
      const fromVal = String(document.getElementById(`${day}From`)?.value || '');
      const toVal = String(document.getElementById(`${day}To`)?.value || '');
      payload[day] = { enabled, from: fromVal, to: toVal };
    });
    openingHoursHidden.value = JSON.stringify(payload);
  };
  dayKeys.forEach((day) => {
    document.getElementById(day)?.addEventListener('change', syncOpeningHours);
    document.getElementById(`${day}From`)?.addEventListener('input', syncOpeningHours);
    document.getElementById(`${day}To`)?.addEventListener('input', syncOpeningHours);
  });

  const galleryGrid = form.querySelector('[data-restaurant-upload-grid]');
  let uploadTile = form.querySelector('[data-restaurant-upload-tile]')?.closest('.col');
  const galleryInput = document.getElementById('galleryPhotos');
  const coverInput = document.getElementById('coverPhoto');
  const selectedGalleryFiles = [];
  let nextGalleryFileId = 1;
  const syncGalleryInputFiles = () => {
    if (!galleryInput) return;
    const dt = new DataTransfer();
    selectedGalleryFiles.forEach((row) => {
      if (row?.file) dt.items.add(row.file);
    });
    galleryInput.files = dt.files;
  };
  const createGalleryCard = (src, fileId = null) => {
    const col = document.createElement('div');
    col.className = 'col';
    if (fileId !== null) col.dataset.fileId = String(fileId);
    col.innerHTML = `
      <div class="hover-effect-opacity position-relative overflow-hidden rounded">
        <div class="ratio" style="--fn-aspect-ratio: calc(180 / 268 * 100%)">
          <img src="${src}" alt="Image">
        </div>
        <div class="hover-effect-target position-absolute top-0 start-0 d-flex align-items-center justify-content-center w-100 h-100 opacity-0">
          <button type="button" class="btn btn-icon btn-sm btn-light position-relative z-2" aria-label="Remove"><i class="fi-trash fs-base"></i></button>
          <span class="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-25 z-1"></span>
        </div>
      </div>
    `;
    return col;
  };

  if (galleryGrid && uploadTile && galleryInput) {
    // Hard reset tile node so old listeners cannot fire twice.
    const freshTile = uploadTile.cloneNode(true);
    uploadTile.parentNode?.replaceChild(freshTile, uploadTile);
    uploadTile = freshTile;

    Array.from(galleryGrid.children).forEach((col) => {
      if (col !== uploadTile) col.remove();
    });
    uploadTile.style.cursor = 'pointer';
    if (uploadTile.dataset.mcUploadBound !== '1') {
      uploadTile.dataset.mcUploadBound = '1';
      uploadTile.addEventListener('click', (event) => {
        if (event.target && event.target.closest('button[aria-label="Remove"]')) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        galleryInput.click();
      }, true);
    }

    if (galleryInput.dataset.mcUploadInputBound !== '1') {
      galleryInput.dataset.mcUploadInputBound = '1';
      galleryInput.addEventListener('change', () => {
        const files = Array.from(galleryInput.files || []);
        files.forEach((file) => {
          const fileId = nextGalleryFileId++;
          selectedGalleryFiles.push({ id: fileId, file });
          const card = createGalleryCard(URL.createObjectURL(file), fileId);
          galleryGrid.insertBefore(card, uploadTile);
        });
        syncGalleryInputFiles();
        if (files[0] && coverInput) {
          const dt = new DataTransfer();
          dt.items.add(files[0]);
          coverInput.files = dt.files;
        }
      });
    }

    galleryGrid.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest('button[aria-label="Remove"]');
      if (!btn) return;
      const col = btn.closest('.col');
      if (!col || col === uploadTile) return;
      const id = Number(col.dataset.fileId || '0');
      if (id > 0) {
        const idx = selectedGalleryFiles.findIndex((row) => row.id === id);
        if (idx >= 0) selectedGalleryFiles.splice(idx, 1);
        syncGalleryInputFiles();
      }
      col.remove();
    }, true);
  }

  if (isEdit) {
    const byId = (id) => document.getElementById(id);
    if (byId('restaurantName')) byId('restaurantName').value = editData.title || '';
    if (byId('city')) byId('city').value = editData.city || '';
    if (byId('cuisineType') && editData.cuisine_type) {
      const sel = byId('cuisineType');
      let opt = Array.from(sel.options).find((o) => (o.textContent || '').trim().toLowerCase() === String(editData.cuisine_type).trim().toLowerCase());
      if (!opt) {
        opt = document.createElement('option');
        opt.textContent = editData.cuisine_type;
        opt.value = editData.cuisine_type;
        sel.appendChild(opt);
      }
      sel.value = opt.value || editData.cuisine_type;
    }
    if (byId('priceRange') && editData.price_range) {
      const range = String(editData.price_range).replace(/\s*avg$/i, '').trim();
      byId('priceRange').value = range;
    }
    if (byId('addressLine')) byId('addressLine').value = editData.address || '';
    if (byId('zipCode')) byId('zipCode').value = editData.zip_code || '';
    if (byId('country')) byId('country').value = editData.country || '';
    if (byId('seatingCapacity')) byId('seatingCapacity').value = editData.seating_capacity || '';
    if (byId('contactName')) byId('contactName').value = editData.contact_name || '';
    if (byId('phone')) byId('phone').value = editData.phone || '';
    if (byId('email')) byId('email').value = editData.email || '';

    const normalizeService = (value) => String(value || '').toLowerCase().replace(/[\s_-]+/g, '');
    const services = Array.isArray(editData.services) ? editData.services.map((v) => normalizeService(v)) : [];
    form.querySelectorAll('input[name="services[]"]').forEach((box) => {
      const key = normalizeService(box.value || box.id || '');
      box.checked = services.includes(key);
    });

    const hours = editData.opening_hours && typeof editData.opening_hours === 'object' ? editData.opening_hours : {};
    dayKeys.forEach((day) => {
      const row = hours[day] || {};
      const enabled = !!row.enabled;
      const fromVal = String(row.from || '');
      const toVal = String(row.to || '');
      const dayToggle = document.getElementById(day);
      const dayFrom = document.getElementById(`${day}From`);
      const dayTo = document.getElementById(`${day}To`);
      if (dayToggle) dayToggle.checked = enabled;
      if (dayFrom && fromVal) dayFrom.value = fromVal;
      if (dayTo && toVal) dayTo.value = toVal;
    });

    if (galleryGrid && uploadTile) {
      Array.from(galleryGrid.children).forEach((col) => {
        if (col !== uploadTile) col.remove();
      });
      const gallery = Array.isArray(editData.gallery_images) ? editData.gallery_images : [];
      if (gallery.length) {
        gallery.forEach((src) => galleryGrid.insertBefore(createGalleryCard(src), uploadTile));
      } else if (editData.image) {
        galleryGrid.insertBefore(createGalleryCard(editData.image), uploadTile);
      }
    }

    const actions = form.querySelector('.col-12.d-flex.flex-wrap.gap-2.justify-content-end.pt-2');
    if (actions) {
      const delForm = document.createElement('form');
      delForm.method = 'post';
      delForm.action = '/account/listings/delete';
      delForm.innerHTML = `
        <input type="hidden" name="_token" value="__SCRIPT_CSRF__">
        <input type="hidden" name="listing_id" value="${String(editData.id)}">
        <button type="submit" class="btn btn-outline-danger">Delete listing</button>
      `;
      delForm.addEventListener('submit', (event) => {
        if (!window.confirm('Delete this listing?')) event.preventDefault();
      });
      actions.prepend(delForm);
    }
  }

  form.addEventListener('submit', () => {
    syncOpeningHours();
  });
  syncOpeningHours();
})();
</script>
HTML;
        $restaurantScript = str_replace('__RESTAURANT_EDIT_DATA__', $restaurantEditJson ?: 'null', $restaurantScript);
        $restaurantScript = str_replace('__SCRIPT_CSRF__', csrf_token(), $restaurantScript);
        $html = str_replace('</body>', $restaurantScript . '</body>', $html);
    }

    if ($file === 'add-car.html') {
        $carEditPayload = null;
        $editId = (int) request()->query('edit', 0);
        if ($editId > 0) {
            $editQuery = Listing::query()
                ->with(['carDetail', 'city'])
                ->where('id', $editId)
                ->where('module', 'cars');

            if (Auth::check()) {
                $editQuery->where('user_id', Auth::id());
            }

            $editListing = $editQuery->first();

            if ($editListing) {
                $title = trim((string) $editListing->title);
                $yearFromDetail = (string) ($editListing->carDetail?->year ?? '');
                $titleWithoutYear = $title;
                if ($yearFromDetail !== '' && str_ends_with($titleWithoutYear, ' ' . $yearFromDetail)) {
                    $titleWithoutYear = trim(substr($titleWithoutYear, 0, -1 * (strlen($yearFromDetail) + 1)));
                }
                $titleParts = preg_split('/\s+/', $titleWithoutYear) ?: [];
                $carEditPayload = [
                    'id' => $editListing->id,
                    'slug' => (string) $editListing->slug,
                    'title' => $title,
                    'brand' => (string) ($editListing->carDetail?->brand ?: ($titleParts[0] ?? '')),
                    'model' => (string) ($editListing->carDetail?->model ?: trim(implode(' ', array_slice($titleParts, 1)))),
                    'condition' => (string) ($editListing->carDetail?->condition ?? ''),
                    'year' => (string) ($editListing->carDetail?->year ?? ''),
                    'city' => (string) ($editListing->city?->name ?? ''),
                    'mileage' => (string) ($editListing->carDetail?->mileage ?? ''),
                    'radius' => (string) ($editListing->carDetail?->radius ?? ''),
                    'drive_type' => (string) ($editListing->carDetail?->drive_type ?? ''),
                    'engine' => (string) ($editListing->carDetail?->engine ?? ''),
                    'fuel_type' => (string) ($editListing->carDetail?->fuel_type ?? ''),
                    'transmission' => (string) ($editListing->carDetail?->transmission ?? ''),
                    'body_type' => (string) ($editListing->carDetail?->body_type ?? ''),
                    'city_mpg' => (string) ($editListing->carDetail?->city_mpg ?? ''),
                    'highway_mpg' => (string) ($editListing->carDetail?->highway_mpg ?? ''),
                    'exterior_color' => (string) ($editListing->carDetail?->exterior_color ?? ''),
                    'interior_color' => (string) ($editListing->carDetail?->interior_color ?? ''),
                    'description' => (string) ($editListing->excerpt ?? ''),
                    'seller_type' => (string) ($editListing->carDetail?->seller_type ?? ''),
                    'contact_first_name' => (string) ($editListing->carDetail?->contact_first_name ?? ''),
                    'contact_last_name' => (string) ($editListing->carDetail?->contact_last_name ?? ''),
                    'contact_email' => (string) ($editListing->carDetail?->contact_email ?? ''),
                    'contact_phone' => (string) ($editListing->carDetail?->contact_phone ?? ''),
                    'negotiated' => (bool) ($editListing->carDetail?->negotiated ?? false),
                    'installments' => (bool) ($editListing->carDetail?->installments ?? false),
                    'exchange' => (bool) ($editListing->carDetail?->exchange ?? false),
                    'uncleared' => (bool) ($editListing->carDetail?->uncleared ?? false),
                    'dealer_ready' => (bool) ($editListing->carDetail?->dealer_ready ?? false),
                    'price' => (string) ($editListing->price ?? ''),
                    'image' => (string) $editListing->image_url,
                    'features' => array_values($editListing->features ?? []),
                    'wizard_data' => $editListing->carDetail?->wizard_data ?? [],
                ];
            }
        }
        $carEditJson = json_encode($carEditPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);

        $carPreviewScript = <<<'HTML'
<script>
(() => {
  const form = document.getElementById('addCarForm');
  if (!form) return;
  let editData = __CAR_EDIT_DATA__;
  const editIdFromUrl = new URLSearchParams(window.location.search).get('edit');

  const photosSection = Array.from(form.querySelectorAll('section'))
    .find((section) => (section.querySelector('h2')?.textContent || '').toLowerCase().includes('photos / videos'));
  const galleryGrid = photosSection?.querySelector('.row.row-cols-2.row-cols-sm-3.g-2.g-md-4.g-lg-3.g-xl-4');
  const uploadTile = galleryGrid?.querySelector('.cursor-pointer.bg-body-tertiary.border-dotted')?.closest('.col');

  // Remove template dummy photo cards from upload grid.
  if (galleryGrid && uploadTile) {
    Array.from(galleryGrid.children).forEach((col) => {
      if (col !== uploadTile) col.remove();
    });
  }

  const previewCard = document.querySelector('#quickPreview article.card') || document.querySelector('aside article.card');

  const previewImage = previewCard?.querySelector('.card-img-top img');
  const previewBadge = previewCard?.querySelector('.badge');
  const previewDate = previewCard?.querySelector('.fs-xs.text-body-secondary.me-3');
  const previewTitleLink = previewCard?.querySelector('h3.h6 a');
  const previewYear = previewCard?.querySelector('h3.h6 span');
  const previewPrice = previewCard?.querySelector('.h6.mb-0');
  const footerCols = previewCard ? previewCard.querySelectorAll('.card-footer .row .col') : [];
  const previewCity = footerCols[0];
  const previewMileage = footerCols[1];
  const previewFuel = footerCols[2];
  const previewTransmission = footerCols[3];
  const detailPreviewBtn = Array.from(document.querySelectorAll('a.btn, button.btn'))
    .find((el) => ((el.textContent || '').trim().toLowerCase() === 'detailed preview'));

  const defaultImage = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 427%22%3E%3Crect width=%22640%22 height=%22427%22 fill=%22%23eef2f6%22/%3E%3Cpath d=%22M183 260h274l35 47H148l35-47zm74-57h126l26 39H231l26-39z%22 fill=%22%23c6d0db%22/%3E%3Ccircle cx=%22223%22 cy=%22322%22 r=%2228%22 fill=%22%2398a6b6%22/%3E%3Ccircle cx=%22417%22 cy=%22322%22 r=%2228%22 fill=%22%2398a6b6%22/%3E%3Ctext x=%2250%25%22 y=%2248%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23808da0%22 font-size=%2232%22 font-family=%22Arial,sans-serif%22%3ENo image%3C/text%3E%3C/svg%3E';

  // Clear template dummy preview content.
  if (previewImage) previewImage.src = defaultImage;
  if (previewDate) previewDate.textContent = '';
  if (previewTitleLink) previewTitleLink.textContent = 'Car listing';
  if (previewYear) previewYear.textContent = '';
  if (previewPrice) previewPrice.textContent = '$0';
  if (previewCity) previewCity.innerHTML = '<i class="fi-map-pin"></i> -';
  if (previewMileage) previewMileage.innerHTML = '<i class="fi-tachometer"></i> -';
  if (previewFuel) previewFuel.innerHTML = '<i class="fi-gas-pump"></i> -';
  if (previewTransmission) previewTransmission.innerHTML = '<i class="fi-gearbox"></i> -';
  if (detailPreviewBtn) {
    detailPreviewBtn.setAttribute('type', 'button');
    if (detailPreviewBtn.tagName === 'A') detailPreviewBtn.setAttribute('href', '/entry/cars?preview=1&module=cars');
    if (detailPreviewBtn.tagName === 'BUTTON') detailPreviewBtn.setAttribute('formaction', '/entry/cars?preview=1&module=cars');
  }

  const stripTemplateSelectedDefaults = () => {
    form.querySelectorAll('select').forEach((select) => {
      Array.from(select.options).forEach((opt, idx) => {
        if (idx > 0) opt.removeAttribute('selected');
      });
      if (!(editData && editData.id)) {
        select.selectedIndex = 0;
      }
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  stripTemplateSelectedDefaults();

  if (!(editData && editData.id)) {
    form.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"]').forEach((el) => {
      el.value = '';
    });
    form.querySelectorAll('select').forEach((el) => {
      el.selectedIndex = 0;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    form.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.checked = false;
    });
    form.querySelectorAll('input[type="radio"]').forEach((el) => {
      el.checked = false;
    });
  }

  const createPhotoCard = (src) => {
    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = `
      <div class="hover-effect-opacity position-relative overflow-hidden rounded">
        <div class="ratio" style="--fn-aspect-ratio: calc(180 / 268 * 100%)">
          <img src="${src}" alt="Uploaded image">
        </div>
        <div class="hover-effect-target position-absolute top-0 start-0 d-flex align-items-center justify-content-center w-100 h-100 opacity-0">
          <button type="button" class="btn btn-icon btn-sm btn-light position-relative z-2" aria-label="Remove">
            <i class="fi-trash fs-base"></i>
          </button>
          <span class="position-absolute top-0 start-0 w-100 h-100 bg-black bg-opacity-25 z-1"></span>
        </div>
      </div>
    `;
    return col;
  };

  const pickSelect = (selectors) => {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of list) {
      const select = form.querySelector(selector);
      if (select) return select;
    }
    return null;
  };

  const selectedOptionText = (selectors) => {
    const select = pickSelect(selectors);
    if (!select) return '';
    const option = select.options?.[select.selectedIndex];
    const text = (option?.textContent || '').trim();
    return /^select /i.test(text) ? '' : text;
  };

  const selectedOptionValue = (selectors) => {
    const select = pickSelect(selectors);
    if (!select) return '';
    const option = select.options?.[select.selectedIndex];
    const text = (option?.textContent || '').trim();
    const value = String(select.value || '').trim();
    if (value === '' || /^select /i.test(text)) return '';
    return value;
  };

  const selectedRadioLabel = (name) => {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    if (!checked) return '';
    const label = form.querySelector(`label[for="${checked.id}"]`);
    return (label?.textContent || '').trim();
  };

  const normalizePrice = (raw) => {
    const num = Number(String(raw || '').replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(num) || num <= 0) return '$0';
    return '$' + num.toLocaleString();
  };

  const selectedConditionValue = () => {
    const checked = form.querySelector('input[name="condition"]:checked');
    return String(checked?.value || selectedRadioLabel('condition') || '').trim();
  };

  const setSelectByText = (selectors, value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return;
    const select = pickSelect(selectors);
    if (!select) return;
    let option = Array.from(select.options).find((opt) => {
      const txt = (opt.textContent || '').trim().toLowerCase();
      const val = String(opt.value || '').trim().toLowerCase();
      return txt === normalized || val === normalized;
    });
    if (!option) {
      option = document.createElement('option');
      option.value = String(value).trim();
      option.textContent = String(value).trim();
      select.appendChild(option);
    }
    const applyNative = () => {
      Array.from(select.options).forEach((opt) => { opt.selected = false; });
      option.selected = true;
      select.value = option.value || String(value).trim();
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const applyChoicesUi = () => {
      try {
        const roots = [];
        if (select.nextElementSibling && select.nextElementSibling.classList.contains('choices')) {
          roots.push(select.nextElementSibling);
        }
        if (select.parentElement) {
          Array.from(select.parentElement.children).forEach((node) => {
            if (node !== select && node.classList && node.classList.contains('choices') && !roots.includes(node)) {
              roots.push(node);
            }
          });
        }
        document.querySelectorAll('.choices').forEach((root) => {
          if (root.previousElementSibling === select && !roots.includes(root)) roots.push(root);
        });
        roots.forEach((root) => {
          const selectedItem = root.querySelector('.choices__list--single .choices__item');
          if (selectedItem) {
            selectedItem.textContent = (option.textContent || '').trim();
            selectedItem.setAttribute('data-value', String(option.value || '').trim());
            selectedItem.classList.remove('choices__placeholder');
          }
        });
      } catch (_) {
        // Ignore UI sync failures; native select value is authoritative.
      }
    };

    applyNative();
    applyChoicesUi();
    [80, 260, 700, 1400].forEach((ms) => setTimeout(() => {
      applyNative();
      applyChoicesUi();
    }, ms));
  };

  const setRadioByLabel = (name, value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return;
    const radios = Array.from(form.querySelectorAll(`input[name="${name}"]`));
    for (const radio of radios) {
      const label = form.querySelector(`label[for="${radio.id}"]`);
      const text = (label?.textContent || '').trim().toLowerCase();
      const radioValue = String(radio.value || '').trim().toLowerCase();
      if (text === normalized || radioValue === normalized || radio.id.toLowerCase() === normalized) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  };

  const setRadioById = (name, idValue) => {
    const wanted = String(idValue || '').trim().toLowerCase();
    if (!wanted) return;
    const radio = form.querySelector(`input[name="${name}"][id="${wanted}"]`);
    if (!radio) return;
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const setCheckboxById = (idValue, checked) => {
    const id = String(idValue || '').trim();
    if (!id) return;
    const el = form.querySelector(`input[type="checkbox"]#${id}`);
    if (!el) return;
    el.checked = !!checked;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const setCheckedByIdList = (ids) => {
    if (!Array.isArray(ids)) return;
    const wanted = new Set(ids.map((v) => String(v || '').trim()).filter(Boolean));
    if (!wanted.size) return;
    Array.from(form.querySelectorAll('input[type="checkbox"][id]')).forEach((el) => {
      if (wanted.has(el.id)) {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  };

  const showNativeSelect = (select) => {
    if (!select) return;
    try {
      if (select.nextElementSibling && select.nextElementSibling.classList?.contains('choices')) {
        select.nextElementSibling.remove();
      }
      select.removeAttribute('data-select');
      select.removeAttribute('hidden');
      select.removeAttribute('tabindex');
      select.style.display = '';
      select.style.opacity = '';
      select.style.position = '';
      select.style.pointerEvents = '';
      select.classList.remove('choices__input', 'choices__input--cloned');
      if (!select.classList.contains('form-select')) select.classList.add('form-select');
      if (!select.classList.contains('form-select-lg')) select.classList.add('form-select-lg');
    } catch (_) {
      // Keep flow alive even if one select cannot be normalized.
    }
  };

  const forceNativeForCarDropdowns = () => {
    const selectors = [
      ['select[aria-label="Car brand select"]', 'select[name="brand"]'],
      ['select[aria-label="Car model select"]', 'select[name="model"]'],
      ['select[aria-label="Manufacturing year select"]', 'select[name="year"]'],
      ['select[aria-label="Location select"]', 'select[name="city"]'],
      ['select[aria-label="Radius select"]', 'select[name="radius"]'],
      ['select[aria-label="Drive type select"]', 'select[name="drive_type"]'],
      ['select[aria-label="Engine select"]', 'select[name="engine"]'],
      ['select[aria-label="Fuel select"]', 'select[name="fuel_type"]'],
      ['select[aria-label="Transmission select"]', 'select[name="transmission"]'],
    ];
    selectors.forEach((group) => {
      const sel = pickSelect(group);
      if (sel) showNativeSelect(sel);
    });
  };

  const enforceDropdownPrefill = (source) => {
    const data = source || {};
    const pairs = [
      { selectors: ['select[aria-label="Car brand select"]', 'select[name="brand"]'], value: data.brand },
      { selectors: ['select[aria-label="Car model select"]', 'select[name="model"]'], value: data.model },
      { selectors: ['select[aria-label="Manufacturing year select"]', 'select[name="year"]'], value: data.year },
      { selectors: ['select[aria-label="Location select"]', 'select[name="city"]'], value: data.city },
      { selectors: ['select[aria-label="Radius select"]', 'select[name="radius"]'], value: data.radius },
      { selectors: ['select[aria-label="Drive type select"]', 'select[name="drive_type"]'], value: data.drive_type },
      { selectors: ['select[aria-label="Engine select"]', 'select[name="engine"]'], value: data.engine },
      { selectors: ['select[aria-label="Fuel select"]', 'select[name="fuel_type"]'], value: data.fuel_type },
      { selectors: ['select[aria-label="Transmission select"]', 'select[name="transmission"]'], value: data.transmission },
    ];
    pairs.forEach((row) => {
      if (row.value === undefined || row.value === null || String(row.value).trim() === '') return;
      setSelectByText(row.selectors, row.value);
    });
  };

  const applyEditData = () => {
    if (!editData || !editData.id) return;
    try { forceNativeForCarDropdowns(); } catch (_) {}
    const wizardData = (editData.wizard_data && typeof editData.wizard_data === 'object') ? editData.wizard_data : {};
    const pref = (key, fallback = '') => {
      const w = wizardData[key];
      if (w !== undefined && w !== null && String(w).trim() !== '') return w;
      return fallback;
    };
    const prefBool = (key, fallback = false) => {
      if (wizardData[key] !== undefined) return !!wizardData[key];
      return !!fallback;
    };

    let hiddenId = form.querySelector('input[name="listing_id"]');
    if (!hiddenId) {
      hiddenId = document.createElement('input');
      hiddenId.type = 'hidden';
      hiddenId.name = 'listing_id';
      form.appendChild(hiddenId);
    }
    hiddenId.value = String(editData.id);

    const heading = document.querySelector('h1.h2');
    if (heading) heading.textContent = 'Edit car';

    form.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], textarea').forEach((el) => {
      el.value = '';
    });
    form.querySelectorAll('select').forEach((el) => {
      el.selectedIndex = 0;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    form.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.checked = false;
    });
    form.querySelectorAll('input[type="radio"]').forEach((el) => {
      el.checked = false;
    });

    const mileageInput = form.querySelector('#mileage');
    const priceInput = form.querySelector('#price');
    const cityMpgInput = form.querySelector('#city-mpg');
    const highwayMpgInput = form.querySelector('#highway-mpg');
    const exteriorColorInput = form.querySelector('#exterior-color');
    const interiorColorInput = form.querySelector('#interior-color');
    const descriptionInput = form.querySelector('#description');
    const firstNameInput = form.querySelector('#fn');
    const lastNameInput = form.querySelector('#ln');
    const emailInput = form.querySelector('#email');
    const phoneInput = form.querySelector('#phone');
    if (mileageInput) mileageInput.value = String(pref('mileage', editData.mileage || ''));
    if (priceInput) priceInput.value = String(pref('price', editData.price || '')).replace(/[^\d]/g, '');
    if (cityMpgInput) cityMpgInput.value = String(pref('city_mpg', editData.city_mpg || ''));
    if (highwayMpgInput) highwayMpgInput.value = String(pref('highway_mpg', editData.highway_mpg || ''));
    if (exteriorColorInput) exteriorColorInput.value = String(pref('exterior_color', editData.exterior_color || ''));
    if (interiorColorInput) interiorColorInput.value = String(pref('interior_color', editData.interior_color || ''));
    if (descriptionInput) descriptionInput.value = String(pref('description', editData.description || ''));
    if (firstNameInput) firstNameInput.value = String(pref('contact_first_name', editData.contact_first_name || ''));
    if (lastNameInput) lastNameInput.value = String(pref('contact_last_name', editData.contact_last_name || ''));
    if (emailInput) emailInput.value = String(pref('contact_email', editData.contact_email || ''));
    if (phoneInput) phoneInput.value = String(pref('contact_phone', editData.contact_phone || ''));

    enforceDropdownPrefill({
      brand: pref('brand', editData.brand),
      model: pref('model', editData.model),
      year: pref('year', editData.year),
      city: pref('city', editData.city),
      radius: pref('radius', editData.radius),
      drive_type: pref('drive_type', editData.drive_type),
      engine: pref('engine', editData.engine),
      fuel_type: pref('fuel_type', editData.fuel_type),
      transmission: pref('transmission', editData.transmission),
    });
    setRadioByLabel('condition', pref('condition', editData.condition));
    setRadioByLabel('body', pref('body_type', editData.body_type));
    setRadioById('seller', pref('seller_type', editData.seller_type || 'private'));
    setCheckboxById('negotiated', prefBool('negotiated', !!editData.negotiated));
    setCheckboxById('installments', prefBool('installments', !!editData.installments));
    setCheckboxById('exchange', prefBool('exchange', !!editData.exchange));
    setCheckboxById('uncleared', prefBool('uncleared', !!editData.uncleared));
    setCheckboxById('dealer-ready', prefBool('dealer_ready', !!editData.dealer_ready));

    if (editData.image && galleryGrid && uploadTile) {
      const alreadyInserted = Array.from(galleryGrid.querySelectorAll('img')).some((img) => (img.getAttribute('src') || '').includes(editData.image));
      if (!alreadyInserted) {
        const card = createPhotoCard(editData.image);
        galleryGrid.insertBefore(card, uploadTile);
      }
    }

    if (previewImage && editData.image) {
      previewImage.src = editData.image;
    }
    if (previewTitleLink && editData.title) {
      previewTitleLink.textContent = String(editData.title);
    }
    if (previewPrice && editData.price) {
      previewPrice.textContent = String(editData.price);
    }
    const featureIds = (Array.isArray(editData.features) && editData.features.length)
      ? editData.features
      : (Array.isArray(wizardData.features) ? wizardData.features : []);
    setCheckedByIdList(featureIds);
  };

  const forceApplyEditData = () => {
    if (!(editData && editData.id)) return;
    applyEditData();
    [120, 450, 900, 1500, 2200].forEach((ms) => setTimeout(applyEditData, ms));
    // Hard-sync dropdowns for delayed plugin hydration.
    let dropdownRetries = 0;
    const dropdownSync = setInterval(() => {
      const wizardData = (editData.wizard_data && typeof editData.wizard_data === 'object') ? editData.wizard_data : {};
      enforceDropdownPrefill({
        brand: wizardData.brand ?? editData.brand,
        model: wizardData.model ?? editData.model,
        year: wizardData.year ?? editData.year,
        city: wizardData.city ?? editData.city,
        radius: wizardData.radius ?? editData.radius,
        drive_type: wizardData.drive_type ?? editData.drive_type,
        engine: wizardData.engine ?? editData.engine,
        fuel_type: wizardData.fuel_type ?? editData.fuel_type,
        transmission: wizardData.transmission ?? editData.transmission,
      });
      dropdownRetries += 1;
      if (dropdownRetries >= 20) clearInterval(dropdownSync);
    }, 600);
    let retries = 0;
    const hardSync = setInterval(() => {
      applyEditData();
      retries += 1;
      if (retries >= 12) clearInterval(hardSync);
    }, 500);
  };

  if (editData && editData.id) {
    forceApplyEditData();

    const actions = form.querySelector('section.d-flex.flex-column.flex-sm-row.justify-content-between.gap-3.mt-4');
    if (actions && !actions.querySelector('.js-delete-listing-btn')) {
      const deleteForm = document.createElement('form');
      deleteForm.method = 'post';
      deleteForm.action = '/account/listings/delete';
      deleteForm.className = 'ms-sm-auto';
      deleteForm.innerHTML = `
        <input type="hidden" name="_token" value="__SCRIPT_CSRF__">
        <input type="hidden" name="listing_id" value="${String(editData.id)}">
        <button type="submit" class="btn btn-lg btn-outline-danger js-delete-listing-btn">Delete listing</button>
      `;
      deleteForm.addEventListener('submit', (event) => {
        if (!window.confirm('Delete this listing?')) event.preventDefault();
      });
      actions.appendChild(deleteForm);
    }
  } else {
    if (editIdFromUrl) {
      // Invalid / missing backend record: prevent template defaults from looking like saved data.
      form.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], textarea').forEach((el) => {
        el.value = '';
      });
      form.querySelectorAll('select').forEach((el) => {
        el.selectedIndex = 0;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      form.querySelectorAll('input[type="checkbox"]').forEach((el) => { el.checked = false; });
      form.querySelectorAll('input[type="radio"]').forEach((el) => { el.checked = false; });
      const root = document.querySelector('main .container');
      if (root && !root.querySelector('.monaclick-edit-missing')) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-warning monaclick-edit-missing';
        alert.textContent = 'Listing not found for this edit link. Please open edit from My listings.';
        root.prepend(alert);
      }
    }
  }

  if (editIdFromUrl) {
    fetch(`/account/cars/${encodeURIComponent(editIdFromUrl)}/edit-data`, { credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('no edit payload')))
      .then((payload) => {
        const fresh = payload && payload.data ? payload.data : null;
        if (!fresh || !fresh.id) return;
        editData = fresh;
        forceApplyEditData();
        updatePreview();
        syncPreviewImage();
      })
      .catch(() => {
        // no-op
      });
  }

  const updatePreview = () => {
    const brand = selectedOptionText(['select[aria-label="Car brand select"]', 'select[name="brand"]']);
    const model = selectedOptionText(['select[aria-label="Car model select"]', 'select[name="model"]']);
    const year = selectedOptionText(['select[aria-label="Manufacturing year select"]', 'select[name="year"]']);
    const city = selectedOptionText(['select[aria-label="Location select"]', 'select[name="city"]']);
    const fuel = selectedOptionText(['select[aria-label="Fuel select"]', 'select[name="fuel_type"]']);
    const transmission = selectedOptionText(['select[aria-label="Transmission select"]', 'select[name="transmission"]']);
    const condition = selectedRadioLabel('condition');
    const mileage = (form.querySelector('#mileage')?.value || '').trim();
    const price = (form.querySelector('#price')?.value || '').trim();

    if (previewTitleLink) {
      const title = [brand, model].filter(Boolean).join(' ').trim() || String(editData?.title || '').trim();
      previewTitleLink.textContent = title || 'Car listing';
    }
    if (previewYear) previewYear.textContent = year ? `(${year})` : '';
    if (previewPrice) previewPrice.textContent = normalizePrice(price);
    if (previewCity) previewCity.innerHTML = `<i class="fi-map-pin"></i> ${city || '-'}`;
    if (previewMileage) previewMileage.innerHTML = `<i class="fi-tachometer"></i> ${mileage || '-'}`;
    if (previewFuel) previewFuel.innerHTML = `<i class="fi-gas-pump"></i> ${fuel || '-'}`;
    if (previewTransmission) previewTransmission.innerHTML = `<i class="fi-gearbox"></i> ${transmission || '-'}`;

    if (previewBadge) {
      previewBadge.textContent = condition || 'Car';
      previewBadge.className = 'badge text-bg-warning';
    }
    if (detailPreviewBtn && detailPreviewBtn.tagName === 'A') {
      detailPreviewBtn.setAttribute('href', buildDetailedPreviewUrl());
    }

    const qualityBox = previewCard?.parentElement?.querySelector('.position-relative.bg-body.rounded');
    const qualityValue = qualityBox?.querySelector('.fs-sm.text-end.mb-2');
    const qualityBar = qualityBox?.querySelector('.progress .progress-bar');
    const requiredSelectors = [
      'select[name="brand"]',
      'select[name="model"]',
      'select[name="year"]',
      '#mileage',
      '#price',
      'select[name="city"]',
      'select[name="fuel_type"]',
      'select[name="transmission"]',
    ];
    const done = requiredSelectors.filter((selector) => {
      const el = form.querySelector(selector);
      const value = String(el?.value || '').trim();
      return value !== '' && !/^select/i.test(value);
    }).length;
    const percent = Math.min(100, Math.round((done / requiredSelectors.length) * 100));
    if (qualityValue) qualityValue.textContent = `${percent}%`;
    if (qualityBar) qualityBar.style.width = `${percent}%`;
  };

  const syncPreviewImage = () => {
    if (!galleryGrid || !uploadTile || !previewImage) return;
    const firstUploaded = Array.from(galleryGrid.children)
      .filter((col) => col !== uploadTile)
      .map((col) => col.querySelector('img'))
      .find(Boolean);
    previewImage.src = firstUploaded ? firstUploaded.src : defaultImage;
  };

  const buildDetailedPreviewUrl = () => {
    const brand = selectedOptionText(['select[aria-label="Car brand select"]', 'select[name="brand"]']);
    const model = selectedOptionText(['select[aria-label="Car model select"]', 'select[name="model"]']);
    const year = selectedOptionText(['select[aria-label="Manufacturing year select"]', 'select[name="year"]']);
    const city = selectedOptionText(['select[aria-label="Location select"]', 'select[name="city"]']);
    const fuel = selectedOptionText(['select[aria-label="Fuel select"]', 'select[name="fuel_type"]']);
    const transmission = selectedOptionText(['select[aria-label="Transmission select"]', 'select[name="transmission"]']);
    const body = selectedRadioLabel('body');
    const condition = selectedConditionValue();
    const mileage = (form.querySelector('#mileage')?.value || '').trim();
    const price = normalizePrice((form.querySelector('#price')?.value || '').trim());
    const title = [brand, model, year].filter(Boolean).join(' ').trim() || 'Car listing';
    const image = previewImage?.getAttribute('src') || defaultImage;

    const qs = new URLSearchParams();
    qs.set('preview', '1');
    qs.set('module', 'cars');
    if (editData?.slug) qs.set('slug', String(editData.slug));
    qs.set('title', title);
    qs.set('city', city || '');
    qs.set('price', price || '$0');
    qs.set('image', image);
    qs.set('year', year || '');
    qs.set('mileage', mileage || '');
    qs.set('fuel_type', fuel || '');
    qs.set('transmission', transmission || '');
    qs.set('body_type', body || '');
    qs.set('condition', condition || '');

    return '/entry/cars?' + qs.toString();
  };

  if (detailPreviewBtn) {
    const openDetailedPreview = (event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const targetUrl = buildDetailedPreviewUrl();
      window.open(targetUrl, '_blank', 'noopener');
    };

    detailPreviewBtn.addEventListener('click', openDetailedPreview);
    if (detailPreviewBtn.tagName === 'A') {
      detailPreviewBtn.setAttribute('href', buildDetailedPreviewUrl());
    }
  }

  form.querySelectorAll('input, select, textarea').forEach((el) => {
    el.addEventListener('input', updatePreview);
    el.addEventListener('change', updatePreview);
  });

  form.addEventListener('submit', () => {
    const ensureHidden = (name, value) => {
      let field = form.querySelector(`input[type="hidden"][name="${name}"]`);
      if (!field) {
        field = document.createElement('input');
        field.type = 'hidden';
        field.name = name;
        form.appendChild(field);
      }
      field.value = String(value ?? '').trim();
    };

    const sellerChecked = form.querySelector('input[name="seller"]:checked');
    const bodyChecked = form.querySelector('input[name="body"]:checked');
    ensureHidden('condition', selectedConditionValue());
    ensureHidden('brand', selectedOptionValue(['select[aria-label="Car brand select"]', 'select[name="brand"]']));
    ensureHidden('model', selectedOptionValue(['select[aria-label="Car model select"]', 'select[name="model"]']));
    ensureHidden('year', selectedOptionValue(['select[aria-label="Manufacturing year select"]', 'select[name="year"]']));
    ensureHidden('city', selectedOptionValue(['select[aria-label="Location select"]', 'select[name="city"]']));
    ensureHidden('radius', selectedOptionValue(['select[aria-label="Radius select"]', 'select[name="radius"]']));
    ensureHidden('drive_type', selectedOptionValue(['select[aria-label="Drive type select"]', 'select[name="drive_type"]']));
    ensureHidden('engine', selectedOptionValue(['select[aria-label="Engine select"]', 'select[name="engine"]']));
    ensureHidden('fuel_type', selectedOptionValue(['select[aria-label="Fuel select"]', 'select[name="fuel_type"]']));
    ensureHidden('transmission', selectedOptionValue(['select[aria-label="Transmission select"]', 'select[name="transmission"]']));
    ensureHidden('body_type', String(bodyChecked?.value || selectedRadioLabel('body') || '').trim());
    ensureHidden('city_mpg', form.querySelector('#city-mpg')?.value || '');
    ensureHidden('highway_mpg', form.querySelector('#highway-mpg')?.value || '');
    ensureHidden('exterior_color', form.querySelector('#exterior-color')?.value || '');
    ensureHidden('interior_color', form.querySelector('#interior-color')?.value || '');
    ensureHidden('description', form.querySelector('#description')?.value || '');
    ensureHidden('seller_type', sellerChecked?.id || 'private');
    ensureHidden('contact_first_name', form.querySelector('#fn')?.value || '');
    ensureHidden('contact_last_name', form.querySelector('#ln')?.value || '');
    ensureHidden('contact_email', form.querySelector('#email')?.value || '');
    ensureHidden('contact_phone', form.querySelector('#phone')?.value || '');
    ensureHidden('negotiated', form.querySelector('#negotiated')?.checked ? '1' : '0');
    ensureHidden('installments', form.querySelector('#installments')?.checked ? '1' : '0');
    ensureHidden('exchange', form.querySelector('#exchange')?.checked ? '1' : '0');
    ensureHidden('uncleared', form.querySelector('#uncleared')?.checked ? '1' : '0');
    ensureHidden('dealer_ready', form.querySelector('#dealer-ready')?.checked ? '1' : '0');

    const selectedFeatures = Array.from(form.querySelectorAll('input[type="checkbox"][id]:checked'))
      .map((el) => el.id)
      .filter((id) => !['negotiated', 'installments', 'exchange', 'uncleared', 'dealer-ready'].includes(id));
    let hidden = form.querySelector('input[type="hidden"][name="features_json"]');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'features_json';
      form.appendChild(hidden);
    }
    hidden.value = JSON.stringify(selectedFeatures);
  });

  if (galleryGrid) {
    const observer = new MutationObserver(syncPreviewImage);
    observer.observe(galleryGrid, { childList: true, subtree: true });
  }

  updatePreview();
  syncPreviewImage();
})();
</script>
HTML;
        $carPreviewScript = str_replace('__CAR_EDIT_DATA__', $carEditJson ?: 'null', $carPreviewScript);
        $carPreviewScript = str_replace('__SCRIPT_CSRF__', csrf_token(), $carPreviewScript);
        $html = str_replace('</body>', $carPreviewScript . '</body>', $html);
    }

    if ($noFlashPage) {
        $revealScript = <<<'HTML'
<script>
(() => {
  const reveal = () => {
    document.body.classList.add('account-dom-ready');
    const style = document.getElementById('account-noflash-style');
    if (style) style.remove();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(reveal), { once: true });
  } else {
    requestAnimationFrame(reveal);
  }
})();
</script>
HTML;
        $html = str_replace('</body>', $revealScript . '</body>', $html);
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
Route::get('/add-property-location', fn () => $serve('add-property-location.html'));
Route::get('/add-property-photos', fn () => $serve('add-property-photos.html'));
Route::get('/add-property-details', fn () => $serve('add-property-details.html'));
Route::get('/add-property-price', fn () => $serve('add-property-price.html'));
Route::get('/add-property-contact-info', fn () => $serve('add-property-contact-info.html'));
Route::get('/add-property-promotion', fn () => $serve('add-property-promotion.html'));
Route::get('/add-contractor', fn () => $serve('add-contractor-location.html'));
Route::get('/add-contractor-services', fn () => $serve('add-contractor-services.html'));
Route::get('/add-contractor-price-hours', fn () => $serve('add-contractor-price-hours.html'));
Route::get('/add-contractor-project', fn () => $serve('add-contractor-project.html'));
Route::get('/add-contractor-profile', fn () => $serve('add-contractor-profile.html'));
Route::get('/sell-car', function (Request $request) use ($serve) {
    $editId = (int) $request->query('edit', 0);
    if ($editId > 0) {
        if (! Auth::check()) {
            return redirect('/signin');
        }
        $exists = Listing::query()
            ->where('id', $editId)
            ->where('module', 'cars')
            ->where('user_id', Auth::id())
            ->exists();
        if (! $exists) {
            return redirect('/account/listings?error=invalid-edit');
        }
    }
    return $serve('add-car.html');
});
Route::get('/add-car', function (Request $request) use ($serve) {
    $editId = (int) $request->query('edit', 0);
    if ($editId > 0) {
        if (! Auth::check()) {
            return redirect('/signin');
        }
        $exists = Listing::query()
            ->where('id', $editId)
            ->where('module', 'cars')
            ->where('user_id', Auth::id())
            ->exists();
        if (! $exists) {
            return redirect('/account/listings?error=invalid-edit');
        }
    }
    return $serve('add-car.html');
});
Route::match(['get', 'post'], '/submit/car', CarListingSubmissionController::class);
Route::match(['get', 'post'], '/submit/property', [ListingSubmissionController::class, 'property']);
Route::match(['get', 'post'], '/submit/contractor', [ListingSubmissionController::class, 'contractor']);
Route::match(['get', 'post'], '/submit/restaurant', [ListingSubmissionController::class, 'restaurant']);
Route::get('/add-restaurant', fn () => $serve('add-restaurant.html'));
Route::get('/add-contractor-location', fn () => $serve('add-contractor-location.html'));
Route::get('/about', fn () => $serve('about-v2.html'));
Route::get('/blog', fn () => $serve('blog-layout-v1.html'));
Route::get('/contact', fn () => $serve('contact-v2.html'));
Route::get('/terms-and-conditions', fn () => $serve('terms-and-conditions.html'));
Route::get('/signin', function () use ($serve) {
    if (Auth::check()) {
        return redirect('/account/profile');
    }
    return $serve('account-signin.html');
});
Route::get('/signup', function () use ($serve) {
    if (Auth::check()) {
        return redirect('/account/profile');
    }
    return $serve('account-signup.html');
});
Route::get('/password-recovery', function () use ($serve) {
    if (Auth::check()) {
        return redirect('/account/profile');
    }
    return $serve('account-password-recovery.html');
});
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
Route::get('/signout', function (Request $request) {
    Auth::logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/signin');
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
    Route::get('/account/cars/{listing}/edit-data', function (int $listing) {
        $editListing = Listing::query()
            ->with(['carDetail', 'city'])
            ->where('id', $listing)
            ->where('module', 'cars')
            ->where('user_id', Auth::id())
            ->first();

        if (! $editListing) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $title = trim((string) $editListing->title);
        $yearFromDetail = (string) ($editListing->carDetail?->year ?? '');
        $titleWithoutYear = $title;
        if ($yearFromDetail !== '' && str_ends_with($titleWithoutYear, ' ' . $yearFromDetail)) {
            $titleWithoutYear = trim(substr($titleWithoutYear, 0, -1 * (strlen($yearFromDetail) + 1)));
        }
        $titleParts = preg_split('/\s+/', $titleWithoutYear) ?: [];

        return response()->json([
            'data' => [
                'id' => $editListing->id,
                'slug' => (string) $editListing->slug,
                'title' => $title,
                'brand' => (string) ($editListing->carDetail?->brand ?: ($titleParts[0] ?? '')),
                'model' => (string) ($editListing->carDetail?->model ?: trim(implode(' ', array_slice($titleParts, 1)))),
                'condition' => (string) ($editListing->carDetail?->condition ?? ''),
                'year' => (string) ($editListing->carDetail?->year ?? ''),
                'city' => (string) ($editListing->city?->name ?? ''),
                'mileage' => (string) ($editListing->carDetail?->mileage ?? ''),
                'radius' => (string) ($editListing->carDetail?->radius ?? ''),
                'drive_type' => (string) ($editListing->carDetail?->drive_type ?? ''),
                'engine' => (string) ($editListing->carDetail?->engine ?? ''),
                'fuel_type' => (string) ($editListing->carDetail?->fuel_type ?? ''),
                'transmission' => (string) ($editListing->carDetail?->transmission ?? ''),
                'body_type' => (string) ($editListing->carDetail?->body_type ?? ''),
                'city_mpg' => (string) ($editListing->carDetail?->city_mpg ?? ''),
                'highway_mpg' => (string) ($editListing->carDetail?->highway_mpg ?? ''),
                'exterior_color' => (string) ($editListing->carDetail?->exterior_color ?? ''),
                'interior_color' => (string) ($editListing->carDetail?->interior_color ?? ''),
                'description' => (string) ($editListing->excerpt ?? ''),
                'seller_type' => (string) ($editListing->carDetail?->seller_type ?? ''),
                'contact_first_name' => (string) ($editListing->carDetail?->contact_first_name ?? ''),
                'contact_last_name' => (string) ($editListing->carDetail?->contact_last_name ?? ''),
                'contact_email' => (string) ($editListing->carDetail?->contact_email ?? ''),
                'contact_phone' => (string) ($editListing->carDetail?->contact_phone ?? ''),
                'negotiated' => (bool) ($editListing->carDetail?->negotiated ?? false),
                'installments' => (bool) ($editListing->carDetail?->installments ?? false),
                'exchange' => (bool) ($editListing->carDetail?->exchange ?? false),
                'uncleared' => (bool) ($editListing->carDetail?->uncleared ?? false),
                'dealer_ready' => (bool) ($editListing->carDetail?->dealer_ready ?? false),
                'price' => (string) ($editListing->price ?? ''),
                'image' => (string) $editListing->image_url,
                'features' => array_values($editListing->features ?? []),
                'wizard_data' => $editListing->carDetail?->wizard_data ?? [],
            ],
        ]);
    });
    Route::get('/account/contractors/{listing}/edit-data', function (int $listing) {
        $editListing = Listing::query()
            ->with(['contractorDetail', 'city', 'images'])
            ->where('id', $listing)
            ->where('module', 'contractors')
            ->where('user_id', Auth::id())
            ->first();

        if (! $editListing) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $serviceArea = (string) ($editListing->contractorDetail?->service_area ?? '');
        $address = '';
        $zip = '';
        if ($serviceArea !== '') {
            $parts = array_values(array_filter(array_map('trim', explode(',', $serviceArea))));
            $zipCandidate = end($parts) ?: '';
            if ($zipCandidate !== '' && preg_match('/\d/', $zipCandidate)) {
                $zip = (string) $zipCandidate;
                array_pop($parts);
            }
            if (count($parts) > 0) {
                $address = (string) $parts[0];
            }
        }

        $priceRaw = (string) ($editListing->price ?? '');
        $priceValue = preg_replace('/[^\d]/', '', $priceRaw) ?: '';

        return response()->json([
            'data' => [
                'id' => $editListing->id,
                'title' => (string) $editListing->title,
                'project_name' => (string) $editListing->title,
                'project_description' => (string) ($editListing->excerpt ?? ''),
                'price_value' => (string) $priceValue,
                'city' => (string) ($editListing->city?->name ?? ''),
                'service_area' => $serviceArea,
                'address' => $address,
                'zip' => $zip,
                'image' => (string) $editListing->image_url,
                'gallery_images' => $editListing->images
                    ->sortBy('sort_order')
                    ->values()
                    ->map(fn ($img) => (string) $img->image_url)
                    ->all(),
            ],
        ]);
    });
    Route::post('/account/contractors/{listing}/profile-photo', function (Request $request, int $listing) {
        $record = Listing::query()
            ->where('id', $listing)
            ->where('module', 'contractors')
            ->where('user_id', Auth::id())
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $request->validate([
            'profile_photo' => ['required', 'image', 'max:8192'],
        ]);

        $file = $request->file('profile_photo');
        if (! ($file instanceof \Illuminate\Http\UploadedFile) || ! $file->isValid()) {
            return response()->json(['message' => 'Invalid upload'], 422);
        }

        $path = $file->store('listings/contractors/profile', 'public');
        $record->image = $path;
        $record->save();

        return response()->json([
            'ok' => true,
            'image' => $path,
            'image_url' => $record->fresh()->image_url,
        ]);
    });
    Route::post('/account/listings/delete', function (Request $request) {
        $listingId = (int) $request->input('listing_id', 0);
        if ($listingId <= 0) {
            return back();
        }

        $listing = Listing::query()
            ->with(['contractorDetail', 'propertyDetail', 'carDetail', 'eventDetail', 'images'])
            ->where('id', $listingId)
            ->where('user_id', Auth::id())
            ->first();

        if (! $listing) {
            return back();
        }

        $listing->images()->delete();
        $listing->contractorDetail()->delete();
        $listing->propertyDetail()->delete();
        $listing->carDetail()->delete();
        $listing->eventDetail()->delete();
        $listing->delete();

        return redirect('/account/listings');
    });
    Route::post('/account/listings/publish', function (Request $request) {
        $listingId = (int) $request->input('listing_id', 0);
        if ($listingId <= 0) {
            return redirect('/account/listings');
        }

        $listing = Listing::query()
            ->where('id', $listingId)
            ->where('user_id', Auth::id())
            ->first();

        if (! $listing) {
            return redirect('/account/listings');
        }

        $listing->status = 'published';
        if (! $listing->published_at) {
            $listing->published_at = now();
        }
        $listing->save();

        return redirect('/account/listings');
    });
    Route::post('/account/settings', function (Request $request) {
        $validated = $request->validate([
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,' . Auth::id()],
            'phone' => ['nullable', 'string', 'max:50'],
            'birth_date' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'avatar' => ['nullable', 'image', 'max:4096'],
        ]);

        $user = Auth::user();
        if (! $user) {
            return redirect('/signin');
        }

        $user->first_name = trim((string) ($validated['first_name'] ?? ''));
        $user->last_name = trim((string) ($validated['last_name'] ?? ''));
        $user->name = trim(($user->first_name . ' ' . $user->last_name)) ?: ($user->name ?: 'User');
        $user->email = strtolower((string) ($validated['email'] ?? $user->email));
        $user->phone = trim((string) ($validated['phone'] ?? ''));
        $user->birth_date = trim((string) ($validated['birth_date'] ?? ''));
        $user->address = trim((string) ($validated['address'] ?? ''));
        $user->bio = trim((string) ($validated['bio'] ?? ''));

        if ($request->hasFile('avatar')) {
            $path = $request->file('avatar')?->store('profiles', 'public');
            if ($path) {
                $user->avatar_path = $path;
            }
        }

        $user->save();

        return redirect('/account/settings?settings=updated');
    });
    Route::post('/account/avatar', function (Request $request) {
        $validated = $request->validate([
            'avatar' => ['required', 'image', 'max:4096'],
        ]);

        $user = Auth::user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $path = $request->file('avatar')?->store('profiles', 'public');
        if (! $path) {
            return response()->json(['message' => 'Upload failed'], 422);
        }

        $user->avatar_path = $path;
        $user->save();

        return response()->json([
            'ok' => true,
            'avatar_url' => $user->avatar_url,
        ]);
    });
    Route::post('/account/password', function (Request $request) {
        $user = Auth::user();
        if (! $user) {
            return redirect('/signin');
        }

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', Password::defaults(), 'confirmed'],
        ]);

        if (! Hash::check((string) $validated['current_password'], (string) $user->password)) {
            return redirect('/account/settings?error=password');
        }

        $user->password = Hash::make((string) $validated['password']);
        $user->save();

        return redirect('/account/settings?password=updated');
    });
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
