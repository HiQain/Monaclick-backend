<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\City;
use App\Models\ContractorDetail;
use App\Models\Listing;
use App\Models\PropertyDetail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class ListingSubmissionController extends Controller
{
    public function property(Request $request): RedirectResponse
    {
        $payload = $this->decodePayload($request);
        $status = $this->resolveStatus($request);
        $editListing = $this->resolveEditableListing($request, 'real-estate');

        $categorySlug = $this->mapPropertyCategorySlug((string) ($payload['radio:type'] ?? ''));
        $category = $this->resolveCategory('real-estate', $categorySlug);
        $city = $this->resolveCity((string) ($payload['select:city-select'] ?? ''));

        if (! $category || ! $city) {
            return redirect('/add-property?error=missing-taxonomy');
        }

        $title = trim(implode(' ', array_filter([
            (string) ($payload['radio:type'] ?? ''),
            (string) ($payload['address'] ?? ''),
            (string) ($payload['zip'] ?? ''),
        ])));

        if ($title === '') {
            $title = 'Property Listing';
        }

        $listingType = ((string) ($payload['radio:category'] ?? 'sell')) === 'rent' ? 'rent' : 'sale';
        $priceRaw = (string) ($payload['price'] ?? '');
        $price = Listing::normalizePrice($priceRaw !== '' ? $priceRaw : null, $listingType === 'rent');
        $listingData = [
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'real-estate',
            'title' => $title,
            'excerpt' => 'User submitted real-estate listing from frontend form.',
            'price' => $price,
            'budget_tier' => $this->resolveBudgetTier($priceRaw),
            'availability_now' => (bool) ($payload['tour'] ?? false),
            'features' => [],
            'rating' => 0,
            'reviews_count' => 0,
            'status' => $status,
            'published_at' => $status === 'published' ? Carbon::now() : null,
        ];

        if ($editListing) {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'property-listing', $editListing->id);
            $listingData['image'] = $editListing->image ?: '/finder/assets/img/listings/real-estate/03.jpg';
            $editListing->update($listingData);
            $listing = $editListing->fresh(['city']);
        } else {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'property-listing');
            $listingData['user_id'] = auth()->id();
            $listingData['image'] = '/finder/assets/img/listings/real-estate/03.jpg';
            $listing = Listing::query()->create($listingData);
        }

        PropertyDetail::query()->updateOrCreate(
            ['listing_id' => $listing->id],
            [
                'property_type' => $this->mapPropertyType((string) ($payload['radio:type'] ?? '')),
                'bedrooms' => $this->extractCount((string) ($payload['radio:bedrooms'] ?? '')),
                'bathrooms' => $this->extractCount((string) ($payload['radio:bathrooms'] ?? '')),
                'area_sqft' => $this->normalizeInteger((string) ($payload['total-area'] ?? '')),
                'listing_type' => $listingType,
            ]
        );

        return $this->redirectAfterSubmission(
            $status,
            '/add-property',
            '/listings/real-estate',
            $title,
            $listing->id
        );
    }

    public function contractor(Request $request): RedirectResponse
    {
        $payload = $this->decodePayload($request);
        $status = $this->resolveStatus($request);
        $editListing = $this->resolveEditableListing($request, 'contractors');

        $selectedCategory = $this->extractFirstValue($payload['select:select-categories'] ?? null);
        $categorySlug = $this->mapContractorCategorySlug($selectedCategory);
        $category = $this->resolveCategory('contractors', $categorySlug);
        $city = $this->resolveCity((string) ($payload['select:city-select'] ?? ''));

        if (! $category || ! $city) {
            return redirect('/add-contractor?error=missing-taxonomy');
        }

        $projectName = trim((string) ($payload['project-name'] ?? ''));
        $title = $projectName !== '' ? $projectName : ucfirst(str_replace('-', ' ', $category->slug)) . ' Service';
        $priceRaw = (string) ($payload['price'] ?? '');
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

        $listingData = [
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'contractors',
            'title' => $title,
            'excerpt' => trim((string) ($payload['project-description'] ?? '')) ?: 'User submitted contractor service listing from frontend form.',
            'price' => Listing::normalizePrice($priceRaw !== '' ? "From {$priceRaw}" : null),
            'budget_tier' => $this->resolveBudgetTier($priceRaw),
            'availability_now' => true,
            'features' => array_values(array_unique($features)),
            'rating' => 0,
            'reviews_count' => 0,
            'status' => $status,
            'published_at' => $status === 'published' ? Carbon::now() : null,
        ];

        if ($editListing) {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'contractor-service', $editListing->id);
            $listingData['image'] = $editListing->image ?: '/finder/assets/img/listings/contractors/03.jpg';
            $editListing->update($listingData);
            $listing = $editListing->fresh(['city']);
        } else {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'contractor-service');
            $listingData['user_id'] = auth()->id();
            $listingData['image'] = '/finder/assets/img/listings/contractors/03.jpg';
            $listing = Listing::query()->create($listingData);
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
                'license_number' => 'LIC-' . strtoupper(substr(md5($listing->slug), 0, 6)),
                'is_verified' => true,
                'business_hours' => $businessHours,
            ]
        );

        return $this->redirectAfterSubmission(
            $status,
            '/account/listings',
            '/account/listings',
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
        $city = $this->resolveCity((string) $request->input('city', ''));

        if (! $category || ! $city) {
            return redirect('/add-restaurant?error=missing-taxonomy');
        }

        $priceRange = trim((string) $request->input('price_range', ''));
        $price = $priceRange !== '' ? "{$priceRange} avg" : null;
        $services = $request->input('services', []);

        if (is_string($services)) {
            $services = [$services];
        }

        $serviceValues = collect($services)
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->values()
            ->all();

        $features = ['eco-friendly'];
        if (in_array('reservations', $serviceValues, true)) {
            $features[] = 'free-consultation';
        }
        if (in_array('delivery', $serviceValues, true)) {
            $features[] = 'online-consultation';
        }
        if (in_array('family friendly', $serviceValues, true) || in_array('family-friendly', $serviceValues, true)) {
            $features[] = 'weekend-consultations';
        }

        $listingData = [
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'restaurants',
            'title' => $title,
            'excerpt' => 'User submitted restaurant listing from frontend form.',
            'price' => $price,
            'budget_tier' => $this->resolveRestaurantBudgetTier($priceRange),
            'availability_now' => true,
            'features' => array_values(array_unique($features)),
            'rating' => 0,
            'reviews_count' => 0,
            'status' => $status,
            'published_at' => $status === 'published' ? Carbon::now() : null,
        ];

        $uploadedImagePath = null;
        if ($request->hasFile('cover_photo')) {
            $uploadedImagePath = $request->file('cover_photo')?->store('listings/restaurants', 'public');
        }

        if ($editListing) {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'restaurant-listing', $editListing->id);
            $listingData['image'] = $uploadedImagePath ?: ($editListing->image ?: '/finder/assets/img/monaclick/restaurants/user1.jpg');
            $editListing->update($listingData);
            $listing = $editListing->fresh(['city']);
        } else {
            $listingData['slug'] = $this->makeUniqueSlug($title, 'restaurant-listing');
            $listingData['user_id'] = auth()->id();
            $listingData['image'] = $uploadedImagePath ?: '/finder/assets/img/monaclick/restaurants/user1.jpg';
            $listing = Listing::query()->create($listingData);
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

    private function resolveCity(string $rawValue): ?City
    {
        $rawValue = trim($rawValue);
        $slug = Str::slug($rawValue);

        if ($slug !== '') {
            $city = City::query()->where('slug', $slug)->first();
            if ($city) {
                return $city;
            }

            return City::query()->create([
                'name' => ucwords(str_replace('-', ' ', $slug)),
                'slug' => $slug,
                'is_active' => true,
                'sort_order' => (int) City::query()->max('sort_order') + 1,
            ]);
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
        $len = strlen(trim($priceRange));

        return match (true) {
            $len <= 1 => 1,
            $len === 2 => 2,
            $len === 3 => 3,
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
