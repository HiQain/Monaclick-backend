<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarDetail extends Model
{
    use HasFactory;

    protected $fillable = [
        'listing_id',
        'year',
        'mileage',
        'fuel_type',
        'transmission',
        'body_type',
    ];

    protected $casts = [
        'year' => 'integer',
        'mileage' => 'integer',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
