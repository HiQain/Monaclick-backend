<?php

namespace App\Http\Controllers;

use App\Models\CarDetail;
use App\Models\Category;
use App\Models\City;
use App\Models\Listing;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class CarListingSubmissionController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $title = trim((string) $request->input('title', ''));
        $brand = trim((string) $request->input('brand', ''));
        $model = trim((string) $request->input('model', ''));
        $year = trim((string) $request->input('year', ''));

        if ($title === '') {
            $title = trim(implode(' ', array_filter([$brand, $model, $year])));
        }
        if ($title === '') {
            $title = 'Car Listing';
        }

        $bodyType = trim((string) $request->input('body_type', ''));
        $categorySlug = Str::slug($bodyType);
        $category = Category::query()
            ->where('module', 'cars')
            ->when($categorySlug !== '', fn ($query) => $query->where('slug', $categorySlug))
            ->first();

        if (! $category) {
            $category = Category::query()->where('module', 'cars')->orderBy('sort_order')->first();
        }

        $cityRaw = trim((string) $request->input('city', ''));
        $citySlug = Str::slug($cityRaw);
        $city = City::query()
            ->when($citySlug !== '', fn ($query) => $query->where('slug', $citySlug))
            ->first();

        if (! $city) {
            $city = City::query()->orderBy('sort_order')->first();
        }

        if (! $category || ! $city) {
            return redirect('/add-car?error=missing-taxonomy');
        }

        $listingId = (int) $request->input('listing_id', 0);
        $existingListing = null;
        if ($listingId > 0 && auth()->check()) {
            $existingListing = Listing::query()
                ->where('id', $listingId)
                ->where('user_id', auth()->id())
                ->where('module', 'cars')
                ->first();
        }

        $slug = $this->makeUniqueSlug($title, 'car-listing', $existingListing?->id);

        $priceRaw = trim((string) $request->input('price', ''));
        $price = Listing::normalizePrice($priceRaw !== '' ? $priceRaw : null);

        $amount = (int) preg_replace('/[^\d]/', '', (string) $priceRaw);
        $budgetTier = match (true) {
            $amount <= 100 => 1,
            $amount <= 1000 => 2,
            $amount <= 5000 => 3,
            default => 4,
        };

        $status = strtolower((string) $request->input('status', 'published')) === 'draft' ? 'draft' : 'published';

        $coverImage = (string) ($existingListing?->image ?: '/finder/assets/img/placeholders/preview-square.svg');
        $uploadedImage = $request->file('cover_image');
        if (is_array($uploadedImage)) {
            $uploadedImage = $uploadedImage[0] ?? null;
        }

        if ($uploadedImage instanceof \Illuminate\Http\UploadedFile && $uploadedImage->isValid()) {
            $coverImage = $uploadedImage->store('listings/cars', 'public');
        } elseif (! $existingListing) {
            $fallbackImages = [
                '/finder/assets/img/listings/cars/grid/01.jpg',
                '/finder/assets/img/listings/cars/grid/02.jpg',
                '/finder/assets/img/listings/cars/grid/03.jpg',
            ];
            $fallbackIndex = (int) (Listing::query()->where('module', 'cars')->count() % count($fallbackImages));
            $coverImage = $fallbackImages[$fallbackIndex];
        }

        $payload = [
            'user_id' => auth()->id(),
            'category_id' => $category->id,
            'city_id' => $city->id,
            'module' => 'cars',
            'title' => $title,
            'slug' => $slug,
            'excerpt' => 'User submitted car listing from frontend form.',
            'price' => $price,
            'budget_tier' => $budgetTier,
            'availability_now' => true,
            'features' => [],
            'rating' => 0,
            'reviews_count' => 0,
            'image' => $coverImage,
            'status' => $status,
            'published_at' => $status === 'published'
                ? ($existingListing?->published_at ?: Carbon::now())
                : null,
        ];

        if ($existingListing) {
            $existingListing->fill($payload)->save();
            $listing = $existingListing;
        } else {
            $listing = Listing::query()->create($payload);
        }

        CarDetail::query()->updateOrCreate(
            ['listing_id' => $listing->id],
            [
                'year' => (int) $request->input('year'),
                'mileage' => (int) preg_replace('/[^\d]/', '', (string) $request->input('mileage')),
                'fuel_type' => Str::lower((string) $request->input('fuel_type')),
                'transmission' => Str::lower((string) $request->input('transmission')),
                'body_type' => (string) $request->input('body_type'),
            ]
        );

        if ($status === 'draft') {
            return redirect('/add-car?saved=draft');
        }

        return redirect('/listings/cars?created=1&q=' . urlencode($title));
    }

    private function makeUniqueSlug(string $title, string $fallback, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($title);
        if ($baseSlug === '') {
            $baseSlug = $fallback;
        }

        $slug = $baseSlug;
        $suffix = 2;

        while (
            Listing::query()
                ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = "{$baseSlug}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
