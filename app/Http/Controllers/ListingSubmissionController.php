<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\City;
use App\Models\ContractorDetail;
use App\Models\Listing;
use App\Models\ListingImage;
use App\Models\PropertyDetail;
use App\Models\State;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class ListingSubmissionController extends Controller
{
    private function normalizeUsStateCode(string $raw): string
    {
        $raw = trim($raw);
        if ($raw === '') {
            return '';
        }

        if (preg_match('/^[A-Za-z]{2}$/', $raw) === 1) {
            return strtoupper($raw);
        }

        if (preg_match('/\\(([A-Za-z]{2})\\)\\s*$/', $raw, $m) === 1) {
            return strtoupper($m[1]);
        }

        $key = preg_replace('/\\([A-Za-z]{2}\\)\\s*$/', '', $raw) ?? $raw;
        $key = strtolower(trim(preg_replace('/\\s+/', ' ', $key) ?? $key));
        if ($key === '') {
            return '';
        }

        $map = [
            'alabama' => 'AL',
            'alaska' => 'AK',
            'arizona' => 'AZ',
            'arkansas' => 'AR',
            'california' => 'CA',
            'colorado' => 'CO',
            'connecticut' => 'CT',
            'delaware' => 'DE',
            'district of columbia' => 'DC',
            'florida' => 'FL',
            'georgia' => 'GA',
            'hawaii' => 'HI',
            'idaho' => 'ID',
            'illinois' => 'IL',
            'indiana' => 'IN',
            'iowa' => 'IA',
            'kansas' => 'KS',
            'kentucky' => 'KY',
            'louisiana' => 'LA',
            'maine' => 'ME',
            'maryland' => 'MD',
            'massachusetts' => 'MA',
            'michigan' => 'MI',
            'minnesota' => 'MN',
            'mississippi' => 'MS',
            'missouri' => 'MO',
            'montana' => 'MT',
            'nebraska' => 'NE',
            'nevada' => 'NV',
            'new hampshire' => 'NH',
            'new jersey' => 'NJ',
            'new mexico' => 'NM',
            'new york' => 'NY',
            'north carolina' => 'NC',
            'north dakota' => 'ND',
            'ohio' => 'OH',
            'oklahoma' => 'OK',
            'oregon' => 'OR',
            'pennsylvania' => 'PA',
            'rhode island' => 'RI',
            'south carolina' => 'SC',
            'south dakota' => 'SD',
            'tennessee' => 'TN',
            'texas' => 'TX',
            'utah' => 'UT',
            'vermont' => 'VT',
            'virginia' => 'VA',
            'washington' => 'WA',
            'west virginia' => 'WV',
            'wisconsin' => 'WI',
            'wyoming' => 'WY',
        ];

        return $map[$key] ?? '';
    }

    private function storePublicUpload(\Illuminate\Http\UploadedFile $file, string $dir): ?string
    {
        if (! $file->isValid()) {
            return null;
        }

        try {
            return $file->store($dir, 'public');
        } catch (\Throwable $e) {
            // Some environments miss `fileinfo`, causing MIME guessing / extension detection to fail.
            // Fall back to the client-provided extension (or none) so uploads still work.
            $ext = preg_replace('/[^a-z0-9]+/i', '', (string) $file->getClientOriginalExtension());
            $filename = Str::random(40) . ($ext !== '' ? ('.' . strtolower($ext)) : '');

            return $file->storeAs($dir, $filename, 'public');
        }
    }

    public function property(Request $request): RedirectResponse
    {
        if (! auth()->check()) {
            return redirect('/signin');
        }

        $payload = $this->decodePayload($request);
        $status = $this->resolveStatus($request);
        $editListing = $this->resolveEditableListing($request, 'real-estate');
        $existingWizardData = is_array($editListing?->propertyDetail?->wizard_data)
            ? $editListing->propertyDetail->wizard_data
            : [];
        $wizardData = array_merge($existingWizardData, $payload);
        $wizardSession = trim((string) ($wizardData['wizard_session'] ?? ''));
        $wizardSessionMapKey = null;
        if (auth()->check() && $wizardSession !== '') {
            $wizardSessionMapKey = 'property-wizard-map:' . auth()->id() . ':' . md5($wizardSession);
            if (! $editListing) {
                $mappedListingId = (int) Cache::get($wizardSessionMapKey, 0);
                if ($mappedListingId > 0) {
                    $mappedListing = Listing::query()
                        ->where('id', $mappedListingId)
                        ->where('user_id', auth()->id())
                        ->where('module', 'real-estate')
                        ->first();
                    if ($mappedListing) {
                        $editListing = $mappedListing;
                    }
                }
            }
        }
        $inFlightDraftLockKey = null;
        if ($status === 'draft' && ! $editListing && auth()->check() && $wizardSession !== '') {
            $inFlightDraftLockKey = 'property-draft-inflight:' . auth()->id() . ':' . md5($wizardSession);
            if (! Cache::add($inFlightDraftLockKey, 1, now()->addSeconds(20))) {
                // A near-simultaneous click can hit here before the first request finishes.
                // Prefer routing the user to the next wizard step if we already have a listing mapped.
                $nextPath = trim((string) $request->input('next', ''));
                $mappedListingId = $wizardSessionMapKey ? (int) Cache::get($wizardSessionMapKey, 0) : 0;
                if ($mappedListingId > 0 && $nextPath !== '' && str_starts_with($nextPath, '/add-property')) {
                    return redirect($nextPath . '?edit=' . $mappedListingId);
                }
                if ($mappedListingId > 0) {
                    return redirect('/add-property?edit=' . $mappedListingId);
                }

                // If we don't have a mapped listing yet, keep the user in the wizard instead of dumping them
                // to account listings. This is usually caused by duplicate event handlers / double submits.
                $referer = (string) ($request->headers->get('referer') ?? '');
                if ($referer !== '' && str_contains($referer, '/add-property')) {
                    return redirect()->back();
                }

                return redirect('/account/listings?saved=draft');
            }
        }
        if (! $editListing && $status === 'draft' && $wizardSession !== '' && auth()->check()) {
            $sessionDraft = Listing::query()
                ->where('user_id', auth()->id())
                ->where('module', 'real-estate')
                ->where('status', 'draft')
                ->whereHas('propertyDetail', function ($query) use ($wizardSession) {
                    $query->where('wizard_data->wizard_session', $wizardSession);
                })
                ->latest('id')
                ->first();
            if ($sessionDraft) {
                $editListing = $sessionDraft;
            }
        }

        $categorySlug = $this->mapPropertyCategorySlug((string) ($wizardData['radio:type'] ?? ''));
        $category = $this->resolveCategory('real-estate', $categorySlug);
        $stateCode = $this->normalizeUsStateCode((string) ($wizardData['state'] ?? ''));
        if ($stateCode === '' || ! $this->resolveUsState($stateCode)) {
            return redirect('/add-property-location?error=missing-state');
        }
        $city = $this->resolveCity($this->firstNonEmpty($wizardData, [
            'select:city-select',
            'select:location-select',
            'select:city',
            'city-select',
            'city',
        ]), $stateCode);
        if (! $city && $editListing?->city) {
            $city = $editListing->city;
        }

        if (! $category || ! $city) {
            return redirect('/add-property?error=missing-taxonomy');
        }

        $title = trim(implode(' ', array_filter([
            (string) ($wizardData['radio:type'] ?? ''),
            (string) ($wizardData['address'] ?? ''),
            (string) ($wizardData['zip'] ?? ''),
        ])));

        if ($title === '' && $editListing) {
            $title = (string) $editListing->title;
        }
        if ($title === '') {
            $title = 'Property Listing';
        }

        $draftLockKey = null;
        if ($status === 'draft' && ! $editListing && auth()->check()) {
            $payloadHash = md5(json_encode($wizardData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
            $draftLockKey = 'property-draft-lock:' . auth()->id() . ':' . $payloadHash;
            $lockedId = (int) Cache::get($draftLockKey, 0);
            if ($lockedId > 0) {
                $lockedListing = Listing::query()
                    ->where('id', $lockedId)
                    ->where('user_id', auth()->id())
                    ->where('module', 'real-estate')
                    ->first();
                if ($lockedListing) {
                    $editListing = $lockedListing;
                }
            }
        }

        $listingType = ((string) ($wizardData['radio:category'] ?? ($existingWizardData['radio:category'] ?? 'sell'))) === 'rent' ? 'rent' : 'sale';
        $priceRaw = (string) ($wizardData['price'] ?? ($existingWizardData['price'] ?? ''));
        $priceAmount = $this->normalizeInteger($priceRaw);
        $price = Listing::normalizePrice($priceRaw !== '' ? $priceRaw : null, $listingType === 'rent');
        $excerpt = $this->firstNonEmpty($wizardData, [
            'user-info',
            'description',
            'details',
        ]);
        if ($excerpt === '' && $editListing) {
            $excerpt = (string) ($editListing->excerpt ?? '');
        }

        $features = $this->resolvePropertyFeatures($wizardData, $editListing?->features ?? []);
        $listingData = [
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'real-estate',
            'title' => $title,
            'excerpt' => $excerpt,
            'price' => $price,
            'budget_tier' => $this->resolveBudgetTier($priceRaw),
            'availability_now' => (bool) ($wizardData['tour'] ?? ($editListing?->availability_now ?? false)),
            'features' => $features,
            'rating' => 0,
            'reviews_count' => 0,
            'status' => $status,
            'published_at' => $status === 'published'
                ? ($editListing?->published_at ?: Carbon::now())
                : null,
        ];

        if (Schema::hasColumn('listings', 'price_amount')) {
            $listingData['price_amount'] = $priceAmount > 0 ? $priceAmount : null;
        }

        if ($editListing) {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'property-listing', $editListing->id);
            $listingData['image'] = $editListing->image ?: '/finder/assets/img/listings/real-estate/03.jpg';
            $editListing->update($listingData);
            $listing = $editListing->fresh(['city']);
        } else {
            $recentDraft = null;
            if ($status === 'draft' && auth()->check()) {
                $recentDraft = Listing::query()
                    ->where('user_id', auth()->id())
                    ->where('module', 'real-estate')
                    ->where('status', 'draft')
                    ->where('title', $title)
                    ->where('created_at', '>=', Carbon::now()->subMinutes(5))
                    ->latest('id')
                    ->first();
            }

            if ($recentDraft) {
                $listingData['slug'] = $recentDraft->slug ?: $this->makeUniqueSlug($title, 'property-listing', $recentDraft->id);
                $listingData['user_id'] = auth()->id();
                $listingData['image'] = $recentDraft->image ?: '/finder/assets/img/listings/real-estate/03.jpg';
                $recentDraft->update($listingData);
                $listing = $recentDraft->fresh(['city']);
            } else {
                $listingData['slug'] = $this->makeUniqueSlug($title, 'property-listing');
                $listingData['user_id'] = auth()->id();
                $listingData['image'] = '/finder/assets/img/listings/real-estate/03.jpg';
                $listing = Listing::query()->create($listingData);
            }
        }

        $propertyDetailPayload = [
            'property_type' => $this->mapPropertyType((string) ($wizardData['radio:type'] ?? '')),
            'bedrooms' => $this->extractCount((string) ($wizardData['radio:bedrooms'] ?? '')),
            'bathrooms' => $this->extractCount((string) ($wizardData['radio:bathrooms'] ?? '')),
            'area_sqft' => $this->normalizeInteger((string) ($wizardData['total-area'] ?? '')),
            'listing_type' => $listingType,
        ];
        if (Schema::hasColumn('property_details', 'wizard_data')) {
            $propertyDetailPayload['wizard_data'] = $wizardData;
        }

        PropertyDetail::query()->updateOrCreate(
            ['listing_id' => $listing->id],
            $propertyDetailPayload
        );

        if ($request->hasFile('photos')) {
            $files = $request->file('photos');
            if (! is_array($files)) {
                $files = [$files];
            }
              $stored = [];
              foreach ($files as $idx => $file) {
                  if (! $file) {
                      continue;
                  }
                  if (! ($file instanceof \Illuminate\Http\UploadedFile)) {
                      continue;
                  }
                  $path = $this->storePublicUpload($file, 'listings/properties');
                  if (! $path) {
                      continue;
                  }
                  $stored[] = $path;
                  ListingImage::query()->create([
                      'listing_id' => $listing->id,
                      'image_path' => $path,
                    'sort_order' => (int) $idx,
                    'is_cover' => $idx === 0,
                ]);
            }
            if (count($stored) > 0) {
                $listing->image = $stored[0];
                $listing->save();
            }
        }

        if ($draftLockKey && $status === 'draft') {
            Cache::put($draftLockKey, $listing->id, now()->addMinutes(2));
        }
        if ($wizardSessionMapKey) {
            Cache::put($wizardSessionMapKey, $listing->id, now()->addHours(12));
        }
        if ($inFlightDraftLockKey) {
            Cache::forget($inFlightDraftLockKey);
        }

        $nextPath = trim((string) $request->input('next', ''));
        if ($status === 'draft' && $nextPath !== '' && str_starts_with($nextPath, '/add-property')) {
            return redirect($nextPath . '?edit=' . $listing->id);
        }

        return $this->redirectAfterSubmission(
            $status,
            '/account/listings',
            '/listings/real-estate',
            $title,
            $listing->id
        );
    }

    public function contractor(Request $request): RedirectResponse
    {
        if (! auth()->check()) {
            return redirect('/signin');
        }

        $payload = $this->decodePayload($request);
        $status = $this->resolveStatus($request);
        $editListing = $this->resolveEditableListing($request, 'contractors');

        $selectedCategory = $this->firstNonEmpty($payload, [
            'select:select-categories',
            'select:project-type',
            'project-type',
            'radio:project-type',
            'category',
        ]);
        $category = $this->resolveCategory('contractors', $selectedCategory !== '' ? $selectedCategory : 'Remodeling');
        $stateCode = $this->normalizeUsStateCode((string) ($payload['state'] ?? ''));
        $hasValidState = $stateCode !== '' && $this->resolveUsState($stateCode);
        $city = null;

        if ($hasValidState) {
            $city = $this->resolveCity($this->firstNonEmpty($payload, [
                'select:city-select',
                'select:location-select',
                'select:city',
                'city-select',
                'city',
            ]), $stateCode);
        }

        // Edit-mode tolerance: if location fields are missing on the final step, keep the existing city.
        if (! $city && $editListing?->city) {
            $city = $editListing->city;
        }

        if (! $hasValidState && ! $city) {
            return redirect('/add-contractor-location?error=missing-state');
        }

        if (! $category || ! $city) {
            return redirect('/add-contractor?error=missing-taxonomy');
        }

        $projectName = trim((string) ($payload['project-name'] ?? ''));
        $title = $projectName !== '' ? $projectName : ucfirst(str_replace('-', ' ', $category->slug)) . ' Service';
        $priceRaw = (string) ($payload['price'] ?? '');
        $priceAmount = $this->normalizeInteger($priceRaw);
        $features = ['verified-hires'];
        if (($payload['home-renovations'] ?? false) || ($payload['custom-home-building'] ?? false)) {
            $features[] = 'free-estimate';
        }
        if (($payload['architectural-design'] ?? false) || ($payload['bathroom-design'] ?? false)) {
            $features[] = 'free-consultation';
        }
        if (($payload['monday'] ?? false) && ($payload['saturday'] ?? false || $payload['sunday'] ?? false)) {
            $features[] = 'weekend-consultations';
        }

        $servicesRaw = $payload['services'] ?? [];
        if (is_string($servicesRaw)) {
            $servicesRaw = [$servicesRaw];
        }
        $serviceTokens = is_array($servicesRaw)
            ? collect($servicesRaw)
                ->map(fn ($v) => trim((string) $v))
                ->filter()
                ->map(fn ($v) => 'service:' . $v)
                ->values()
                ->all()
            : [];
        $features = array_values(array_unique(array_merge($features, $serviceTokens)));

        $listingData = [
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'contractors',
            'title' => $title,
            'excerpt' => $this->firstNonEmpty($payload, [
                'project-description',
                'user-info',
                'description',
            ]),
            'price' => Listing::normalizePrice($priceRaw !== '' ? "From {$priceRaw}" : null),
            'budget_tier' => $this->resolveBudgetTier($priceRaw),
            'availability_now' => true,
            'features' => array_values(array_unique($features)),
            'rating' => 0,
            'reviews_count' => 0,
            'status' => $status,
            'published_at' => $status === 'published' ? Carbon::now() : null,
        ];

        if (Schema::hasColumn('listings', 'price_amount')) {
            $listingData['price_amount'] = $priceAmount > 0 ? $priceAmount : null;
        }

        if ($editListing) {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'contractor-service', $editListing->id);
            $editListing->update($listingData);
            $listing = $editListing->fresh(['city', 'images']);
        } else {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'contractor-service');
            $listingData['user_id'] = auth()->id();
            $listing = Listing::query()->create($listingData)->fresh(['city', 'images']);
        }

        $serviceArea = trim(implode(', ', array_filter([
            (string) ($payload['address'] ?? ''),
            (string) ($payload['zip'] ?? ''),
            (string) ($payload['area-search'] ?? ''),
        ])));

        $businessHours = [
            'monday' => (bool) ($payload['monday'] ?? false),
            'tuesday' => (bool) ($payload['tuesday'] ?? false),
            'wednesday' => (bool) ($payload['wednesday'] ?? false),
            'thursday' => (bool) ($payload['thursday'] ?? false),
            'friday' => (bool) ($payload['friday'] ?? false),
            'saturday' => (bool) ($payload['saturday'] ?? false),
            'sunday' => (bool) ($payload['sunday'] ?? false),
        ];

        ContractorDetail::query()->updateOrCreate(
            ['listing_id' => $listing->id],
            [
                'service_area' => $serviceArea !== '' ? $serviceArea : ($city->name . ' Metro'),
                'license_number' => $this->firstNonEmpty($payload, ['license-number', 'license_number', 'license']) ?: null,
                'is_verified' => (bool) ($payload['is-verified'] ?? false),
                'business_hours' => $businessHours,
            ]
        );

          $coverPath = null;
          $profilePhoto = $request->file('profile_photo');
          if ($profilePhoto instanceof \Illuminate\Http\UploadedFile && $profilePhoto->isValid()) {
              $coverPath = $this->storePublicUpload($profilePhoto, 'listings/contractors/profile');
          }

        if ($request->hasFile('photos')) {
            $files = $request->file('photos');
            if (! is_array($files)) {
                $files = [$files];
            }

            $listing->images()->delete();
            $stored = [];
            $sort = 0;
              foreach ($files as $file) {
                  if (! ($file instanceof \Illuminate\Http\UploadedFile) || ! $file->isValid()) {
                      continue;
                  }
                  $path = $this->storePublicUpload($file, 'listings/contractors/gallery');
                  if (! $path) {
                      continue;
                  }
                  $stored[] = $path;
                  ListingImage::query()->create([
                      'listing_id' => $listing->id,
                      'image_path' => $path,
                    'sort_order' => $sort,
                    'is_cover' => $sort === 0,
                ]);
                $sort++;
            }
            if (! $coverPath && count($stored) > 0) {
                $coverPath = $stored[0];
            }
        }

        if (! $coverPath) {
            if ($listing->image) {
                $coverPath = $listing->image;
            } else {
                $firstExisting = $listing->images()->orderBy('sort_order')->first();
                $coverPath = $firstExisting?->image_path;
            }
        }

        if ($coverPath !== null && $coverPath !== '') {
            $listing->image = $coverPath;
            $listing->save();
        }

        return $this->redirectAfterSubmission(
            $status,
            '/account/listings',
            '/listings/contractors',
            $title,
            $listing->id
        );
    }

    public function restaurant(Request $request): RedirectResponse
    {
        $status = $this->resolveStatus($request);
        $editListing = $this->resolveEditableListing($request, 'restaurants');

        $title = trim((string) $request->input('restaurant_name', ''));
        if ($title === '') {
            $title = 'Restaurant Listing';
        }

        $category = $this->resolveCategory('restaurants', (string) $request->input('cuisine_type', ''));
        $stateCode = $this->normalizeUsStateCode((string) $request->input('state', ''));
        if ($stateCode === '' || ! $this->resolveUsState($stateCode)) {
            return redirect('/add-restaurant?error=missing-state');
        }
        $city = $this->resolveCity((string) $request->input('city', ''), $stateCode);

        if (! $category || ! $city) {
            return redirect('/add-restaurant?error=missing-taxonomy');
        }

        $priceRange = trim((string) $request->input('price_range', ''));
        $rangeAmount = $priceRange !== '' ? $this->normalizeInteger($priceRange) : 0;
        $price = $rangeAmount > 0 ? ('$' . number_format($rangeAmount)) : null;
        $priceAmount = $rangeAmount > 0 ? $rangeAmount : null;
        $services = $request->input('services', []);

        if (is_string($services)) {
            $services = [$services];
        }

        $serviceAliases = [
            'dinein' => 'dine-in',
            'familyfriendly' => 'family-friendly',
            'outdoor' => 'outdoor-seating',
            'outdoor seating' => 'outdoor-seating',
        ];

        $serviceValues = collect($services)
            ->map(function ($value) use ($serviceAliases) {
                $raw = trim((string) $value);
                $normalized = strtolower($raw);
                return $serviceAliases[$normalized] ?? $raw;
            })
            ->filter()
            ->values()
            ->all();

        $features = [];

        $serviceValues = array_values(array_unique($serviceValues));
        $openingHoursRaw = (string) $request->input('opening_hours', '');
        $openingHours = [];
        if ($openingHoursRaw !== '') {
            $decoded = json_decode($openingHoursRaw, true);
            if (is_array($decoded)) {
                $openingHours = $decoded;
            }
        }

        $restaurantMeta = [
            '_mc_restaurant_v1' => true,
            'address' => trim((string) $request->input('address', '')),
            'zip_code' => trim((string) $request->input('zip_code', '')),
            'country' => 'United States',
            'state' => $stateCode,
            'seating_capacity' => trim((string) $request->input('seating_capacity', '')),
            'services' => $serviceValues,
            'opening_hours' => $openingHours,
            'contact_name' => trim((string) $request->input('contact_name', '')),
            'phone' => trim((string) $request->input('phone', '')),
            'email' => trim((string) $request->input('email', '')),
        ];
        $restaurantMetaJson = json_encode($restaurantMeta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $listingData = [
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'restaurants',
            'title' => $title,
            'excerpt' => $restaurantMetaJson ?: '',
            'price' => $price,
            'budget_tier' => $this->resolveRestaurantBudgetTier($priceRange),
            'availability_now' => true,
            'features' => array_values(array_unique($features)),
            'rating' => 0,
            'reviews_count' => 0,
            'status' => $status,
            'published_at' => $status === 'published' ? Carbon::now() : null,
        ];

        if (Schema::hasColumn('listings', 'price_amount')) {
            $listingData['price_amount'] = $priceAmount && $priceAmount > 0 ? $priceAmount : null;
        }

          $uploadedImagePath = null;
          if ($request->hasFile('cover_photo')) {
              $cover = $request->file('cover_photo');
              if ($cover instanceof \Illuminate\Http\UploadedFile && $cover->isValid()) {
                  $uploadedImagePath = $this->storePublicUpload($cover, 'listings/restaurants');
              }
          }

        if ($editListing) {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'restaurant-listing', $editListing->id);
            $listingData['image'] = $uploadedImagePath ?: ($editListing->image ?: '/finder/assets/img/monaclick/restaurants/user1.jpg');
            $editListing->update($listingData);
            $listing = $editListing->fresh(['city', 'images']);
        } else {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'restaurant-listing');
            $listingData['user_id'] = auth()->id();
            $listingData['image'] = $uploadedImagePath ?: '/finder/assets/img/monaclick/restaurants/user1.jpg';
            $listing = Listing::query()->create($listingData)->fresh(['city', 'images']);
        }

        $galleryCover = null;
        if ($request->hasFile('gallery_photos')) {
            $files = $request->file('gallery_photos');
            if (! is_array($files)) {
                $files = [$files];
            }

            $hasExistingImages = $listing->images()->exists();
            $sort = (int) $listing->images()->max('sort_order');
            $sort = $sort > 0 ? $sort + 1 : 0;
              foreach ($files as $file) {
                  if (! ($file instanceof \Illuminate\Http\UploadedFile) || ! $file->isValid()) {
                      continue;
                  }
                  $path = $this->storePublicUpload($file, 'listings/restaurants/gallery');
                  if (! $path) {
                      continue;
                  }
                  ListingImage::query()->create([
                      'listing_id' => $listing->id,
                      'image_path' => $path,
                      'sort_order' => $sort,
                    'is_cover' => $sort === 0 && ! $hasExistingImages,
                ]);
                if ($sort === 0) {
                    $galleryCover = $path;
                }
                $sort++;
            }
        }

        if ($galleryCover && ! $uploadedImagePath) {
            $listing->image = $galleryCover;
            $listing->save();
        }

        return $this->redirectAfterSubmission(
            $status,
            '/account/listings',
            '/account/listings',
            $listing->title,
            $listing->id
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function decodePayload(Request $request): array
    {
        $encoded = trim((string) $request->input('payload', $request->query('payload', '')));
        if ($encoded === '') {
            return [];
        }

        $decoded = base64_decode($encoded, true);
        if ($decoded === false) {
            return [];
        }

        $payload = json_decode($decoded, true);

        return is_array($payload) ? $payload : [];
    }

    /**
     * @param array<string, mixed> $wizardData
     * @param array<int, mixed> $existingFeatures
     * @return array<int, string>
     */
    private function resolvePropertyFeatures(array $wizardData, array $existingFeatures = []): array
    {
        $derived = [];

        if ($this->wizardTruthy($wizardData, ['negotiated', 'negotiable'])) {
            $derived[] = 'negotiable';
        }

        if ($this->wizardTruthy($wizardData, ['no-credit', 'no_credit', 'noCredit', 'no_credit_sale'])) {
            $derived[] = 'no-credit';
        }

        if ($this->wizardTruthy($wizardData, ['ready-agents', 'ready_agents', 'readyAgents', 'agent'])) {
            $derived[] = 'agent-friendly';
        }

        if ($this->wizardTruthy($wizardData, ['exchange', 'exchange_possible'])) {
            $derived[] = 'exchange';
        }

        $amenities = [
            'tv' => 'tv-set',
            'washing' => 'washing-machine',
            'kitchen' => 'kitchen',
            'ac' => 'air-conditioning',
            'workspace' => 'separate-workplace',
            'fridge' => 'refrigerator',
            'drying' => 'drying-machine',
            'closet' => 'closet',
            'patio' => 'patio',
            'fireplace' => 'fireplace',
            'shower' => 'shower-cabin',
            'whirlpool' => 'whirlpool',
            'cctv' => 'security-cameras',
            'balcony' => 'balcony',
            'bar' => 'bar',
        ];
        foreach ($amenities as $key => $token) {
            if ($this->wizardTruthy($wizardData, [$key])) {
                $derived[] = $token;
            }
        }

        return array_values(array_unique(array_filter(array_map(fn ($v) => trim((string) $v), $derived))));
    }

    /**
     * @param array<string, mixed> $wizardData
     * @param array<int, string> $keys
     */
    private function wizardTruthy(array $wizardData, array $keys): bool
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $wizardData)) {
                continue;
            }
            $value = $wizardData[$key];
            if (is_bool($value)) {
                return $value;
            }
            if (is_int($value) || is_float($value)) {
                return ((float) $value) !== 0.0;
            }
            $str = strtolower(trim((string) $value));
            if ($str === '') {
                return false;
            }
            if (in_array($str, ['1', 'true', 'yes', 'on'], true)) {
                return true;
            }
            if (in_array($str, ['0', 'false', 'no', 'off'], true)) {
                return false;
            }

            return true;
        }

        return false;
    }

    private function resolveStatus(Request $request): string
    {
        $draft = (string) ($request->input('draft', $request->query('draft', '')));
        if ($draft === '1') {
            return 'draft';
        }

        return 'published';
    }

    private function resolveEditableListing(Request $request, string $module): ?Listing
    {
        $listingId = (int) $request->input('listing_id', $request->query('listing_id', 0));
        if ($listingId <= 0) {
            return null;
        }

        return Listing::query()
            ->where('id', $listingId)
            ->where('module', $module)
            ->where('user_id', auth()->id())
            ->first();
    }

    private function resolveCategory(string $module, string $rawValue): ?Category
    {
        $slug = Str::slug($rawValue);
        $name = trim((string) $rawValue);

        $query = Category::query()->where('module', $module);

        if ($slug !== '') {
            $category = (clone $query)->where('slug', $slug)->first();
            if ($category) {
                return $category;
            }

            $category = (clone $query)->where('name', 'like', '%' . $rawValue . '%')->first();
            if ($category) {
                return $category;
            }
        }

        $fallback = (clone $query)->orderBy('sort_order')->first();
        if ($fallback) {
            return $fallback;
        }

        $generatedSlug = $slug !== '' ? $slug : Str::slug($module . '-general');
        $generatedName = $name !== '' ? $name : ucfirst(str_replace('-', ' ', $module)) . ' General';

        return Category::query()->create([
            'module' => $module,
            'name' => $generatedName,
            'slug' => $generatedSlug,
            'sort_order' => (int) Category::query()->where('module', $module)->max('sort_order') + 1,
            'is_active' => true,
        ]);
    }

    private function resolveUsState(string $stateCode): ?State
    {
        $stateCode = strtoupper(trim($stateCode));
        if (preg_match('/^[A-Z]{2}$/', $stateCode) !== 1) {
            return null;
        }

        if (!Schema::hasTable('states')) {
            return new State([
                'country_code' => 'US',
                'code' => $stateCode,
                'name' => $stateCode,
                'is_active' => true,
                'sort_order' => 0,
            ]);
        }

        $state = State::query()
            ->where('country_code', 'US')
            ->where('code', $stateCode)
            ->where('is_active', true)
            ->first();

        // Be tolerant when the `states` table exists but isn't seeded (common on fresh deployments).
        // Public listing forms should still work as long as the state code is valid.
        if (! $state) {
            return new State([
                'country_code' => 'US',
                'code' => $stateCode,
                'name' => $stateCode,
                'is_active' => true,
                'sort_order' => 0,
            ]);
        }

        return $state;
    }

    private function resolveCity(string $rawValue, string $stateCode = ''): ?City
    {
        $rawValue = trim($rawValue);
        $slug = Str::slug($rawValue);
        $stateCode = strtoupper(trim($stateCode));
        if ($stateCode !== '' && ! $this->resolveUsState($stateCode)) {
            return null;
        }

        if ($slug !== '') {
            $city = City::query()
                ->where('slug', $slug)
                ->when($stateCode !== '' && Schema::hasColumn('cities', 'state_code'), fn ($q) => $q->where('state_code', $stateCode))
                ->first();
            if ($city) {
                return $city;
            }

            $payload = [
                'name' => ucwords(str_replace('-', ' ', $slug)),
                'slug' => $slug,
            ];
            if (Schema::hasColumn('cities', 'state_code') && $stateCode !== '') {
                $payload['state_code'] = $stateCode;
            }
            if (Schema::hasColumn('cities', 'is_active')) {
                $payload['is_active'] = true;
            }
            if (Schema::hasColumn('cities', 'sort_order')) {
                $payload['sort_order'] = (int) City::query()->max('sort_order') + 1;
            }

            return City::query()->create($payload);
        }

        return City::query()->orderBy('sort_order')->first();
    }

    private function mapPropertyCategorySlug(string $type): string
    {
        return match (Str::slug($type)) {
            'apartment' => 'apartments',
            'house' => 'family-homes',
            'commercial' => 'commercial-spaces',
            'room' => 'townhouses',
            'garage' => 'condos',
            default => 'family-homes',
        };
    }

    private function mapPropertyType(string $type): string
    {
        return match (Str::slug($type)) {
            'commercial' => 'Commercial',
            default => 'Residential',
        };
    }

    private function mapContractorCategorySlug(?string $selectedCategory): string
    {
        return match (Str::slug((string) $selectedCategory)) {
            'roofing' => 'roofing',
            'plumbing' => 'plumbing',
            'electrician', 'electrical' => 'electrical',
            'painting', 'paiting' => 'painting',
            default => 'remodeling',
        };
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<int, string> $keys
     */
    private function firstNonEmpty(array $payload, array $keys): string
    {
        foreach ($keys as $key) {
            $value = $payload[$key] ?? null;
            if (is_array($value)) {
                $value = $this->extractFirstValue($value);
            }
            $value = trim((string) $value);
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function resolveBudgetTier(string $rawAmount): int
    {
        $amount = $this->normalizeInteger($rawAmount);

        return match (true) {
            $amount <= 100 => 1,
            $amount <= 1000 => 2,
            $amount <= 5000 => 3,
            default => 4,
        };
    }

    private function resolveRestaurantBudgetTier(string $priceRange): int
    {
        $amount = $this->normalizeInteger($priceRange);

        return match (true) {
            $amount <= 500 => 1,
            $amount <= 1000 => 2,
            $amount <= 1500 => 3,
            default => 4,
        };
    }

    private function normalizeInteger(string $value): int
    {
        return (int) preg_replace('/[^\d]/', '', $value);
    }

    private function extractCount(string $value): ?int
    {
        if ($value === '' || Str::endsWith($value, '-any')) {
            return null;
        }

        $count = $this->normalizeInteger($value);

        return $count > 0 ? $count : null;
    }

    /**
     * @param mixed $value
     */
    private function extractFirstValue($value): string
    {
        if (is_array($value)) {
            return trim((string) ($value[0] ?? ''));
        }

        return trim((string) $value);
    }

    private function makeUniqueSlug(string $title, string $fallback, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($title);
        if ($baseSlug === '') {
            $baseSlug = $fallback;
        }

        $slug = $baseSlug;
        $counter = 2;

        while (Listing::query()
            ->where('slug', $slug)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        return $slug;
    }

    private function redirectAfterSubmission(string $status, string $draftPath, string $publishedPath, string $title, ?int $listingId = null): RedirectResponse
    {
        if ($status === 'draft') {
            $qs = $listingId ? ('?saved=draft&edit=' . $listingId) : '?saved=draft';
            return redirect($draftPath . $qs);
        }

        return redirect($publishedPath . '?created=1&q=' . urlencode($title));
    }
}
