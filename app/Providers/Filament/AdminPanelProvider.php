<?php

namespace App\Providers\Filament;

use App\Filament\Resources\Categories\CategoryResource;
use App\Filament\Resources\Cities\CityResource;
use App\Filament\Resources\Listings\ListingResource;
use App\Filament\Resources\Permissions\PermissionResource;
use App\Filament\Resources\Roles\RoleResource;
use App\Filament\Resources\States\StateResource;
use App\Filament\Resources\Users\UserResource;
use App\Filament\Widgets\ListingsOverviewWidget;
use App\Filament\Widgets\ModuleCountsWidget;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Widgets\AccountWidget;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->login()
            ->colors([
                'primary' => Color::Amber,
            ])
            ->resources([
                CategoryResource::class,
                StateResource::class,
                CityResource::class,
                ListingResource::class,
                RoleResource::class,
                PermissionResource::class,
                UserResource::class,
            ])
            ->pages([
                Dashboard::class,
            ])
            ->widgets([
                ListingsOverviewWidget::class,
                ModuleCountsWidget::class,
                AccountWidget::class,
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}
