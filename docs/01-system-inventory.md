# System Inventory Report

## 1. Folder Structure Overview

```text
BikeRentalWeb_php7/
  index.html                  Landing page, reset action trigger
  beach-cruisers.html          Beach bike UI and accessory modal logic
  mountain-bikes.html          Mountain bike UI and accessory modal logic
  package.json                 Node wrapper script for PHP dev server
  watch.js                     Node watcher to delete stale cache files

  handlers/
    bike-handler.php           Bike API endpoint: list, rent, reset
    accessory-handler.php      Accessory API endpoint: list, order

  services/
    ApplicationServices.php    Static service locator/bootstrapper
    BeachCruiserService.php    Beach cruiser rental business logic
    MountainBikeService.php    Mountain bike rental business logic
    AccessoryService.php       Accessory filtering, ordering, stock, discount logic

  data/
    BeachCruiserRepository.php File-backed XML repository
    MountainBikeRepository.php File-backed JSON repository
    AccessoryRepository.php    File-backed JSON repository

  SampleData/
    beach_cruisers.xml         Beach cruiser source data
    mountain_bikes.json        Mountain bike source data
    accessories.json           Accessory source data
```

## 2. Architectural Pattern Currently Used

This is a simple layered legacy module:

```text
Static HTML + jQuery
        |
PHP handler scripts
        |
Static service locator
        |
Service classes
        |
Concrete file repositories
        |
JSON/XML files + serialized cache files
```

It resembles a thin service-layer pattern, but with procedural front controllers rather than a formal MVC framework. The handlers act as controllers, routers, serializers, validators, and response builders.

There is no Composer autoloading, routing framework, dependency injection container, domain model, ORM, database abstraction, or transaction boundary.

## 3. Data Flow From UI To Persistence Layer

### Bike List Flow

```text
beach-cruisers.html / mountain-bikes.html
  -> jQuery $.ajax GET /handlers/bike-handler.php?action=beach|mountain
  -> bike-handler.php switch($_GET['action'])
  -> ApplicationServices::initialize()
  -> BeachCruiserService::getAll() or MountainBikeService::getAll()
  -> Repository::getAll()
  -> read .cache if fresh, otherwise read XML/JSON
  -> handler sanitizes/maps arrays
  -> JSON response
  -> UI renders cards
```

### Bike Rental Flow

```text
UI Rent button
  -> POST /handlers/bike-handler.php?action=rent
  -> JSON body: { bikeType, bikeId }
  -> handler validates method/body
  -> selected service rentBike($bikeId)
  -> repository getAll()
  -> service mutates array availability
  -> repository save()
  -> JSON/XML overwritten and .cache rewritten
```

### Accessory Order Flow

```text
UI opens modal
  -> GET /handlers/accessory-handler.php?bikeType=...
  -> AccessoryService::getCompatibleWith()
  -> AccessoryRepository::getAll()
  -> JSON response

UI confirms accessory quantities
  -> POST /handlers/accessory-handler.php
  -> AccessoryService::processOrder()
  -> validates stock
  -> calculates bundle discount
  -> deducts stock
  -> AccessoryRepository::save()
  -> accessories.json and .cache overwritten
```

### Reset Flow

```text
index.html hidden reset click
  -> POST /handlers/bike-handler.php?action=reset
  -> calls resetToDefaults() on all services
  -> writes hardcoded defaults back to persistence files
```

## 4. Classes And Responsibilities

- `ApplicationServices` in `services/ApplicationServices.php`
  - Static service locator. Creates repositories and services per request.

- `BeachCruiserService` in `services/BeachCruiserService.php`
  - Gets beach cruisers, rents by ID, resets hardcoded beach cruiser defaults.

- `MountainBikeService` in `services/MountainBikeService.php`
  - Gets mountain bikes, rents by ID, resets hardcoded mountain bike defaults.

- `AccessoryService` in `services/AccessoryService.php`
  - Gets accessories, filters compatibility, validates accessory orders, applies bundle discount, deducts stock, resets stock.

- `BeachCruiserRepository` in `data/BeachCruiserRepository.php`
  - Reads/writes beach cruisers from XML and maintains serialized cache.

- `MountainBikeRepository` in `data/MountainBikeRepository.php`
  - Reads/writes mountain bikes from JSON and maintains serialized cache.

- `AccessoryRepository` in `data/AccessoryRepository.php`
  - Reads/writes accessories from JSON and maintains serialized cache.

There are no domain entity classes such as `Bike`, `Accessory`, `Rental`, `Order`, or `Money`. Business objects are associative arrays.

## 5. Dependency Graph

```text
index.html
  -> /handlers/bike-handler.php?action=reset

beach-cruisers.html
  -> /handlers/bike-handler.php?action=beach
  -> /handlers/bike-handler.php?action=rent
  -> /handlers/accessory-handler.php

mountain-bikes.html
  -> /handlers/bike-handler.php?action=mountain
  -> /handlers/bike-handler.php?action=rent
  -> /handlers/accessory-handler.php

bike-handler.php
  -> ApplicationServices
  -> BeachCruiserService
  -> MountainBikeService
  -> AccessoryService
  -> all repositories via require_once

accessory-handler.php
  -> ApplicationServices
  -> AccessoryService
  -> all services and repositories via require_once

ApplicationServices
  -> BeachCruiserRepository -> BeachCruiserService
  -> MountainBikeRepository -> MountainBikeService
  -> AccessoryRepository -> AccessoryService

BeachCruiserRepository
  -> SampleData/beach_cruisers.xml
  -> SampleData/beach_cruisers.xml.cache

MountainBikeRepository
  -> SampleData/mountain_bikes.json
  -> SampleData/mountain_bikes.json.cache

AccessoryRepository
  -> SampleData/accessories.json
  -> SampleData/accessories.json.cache
```

## 6. Areas Of Tight Coupling

- Handlers manually `require_once` every repository and service, even when not all are needed: `handlers/bike-handler.php`, `handlers/accessory-handler.php`.
- Handlers depend on `ApplicationServices` static global state.
- Services depend on concrete repository classes instead of interfaces.
- Frontend depends directly on exact response field names, including inconsistent casing: beach uses `bike_id`, mountain uses `BikeID`.
- Business rules are duplicated between frontend and backend, especially bundle IDs and discount calculation.
- Persistence format leaks upward: service logic knows exact array keys from JSON/XML.
- Reset defaults are hardcoded in service classes rather than loaded from seed data/configuration.
- File persistence, cache format, and repository behavior are inseparable.

## 7. Areas Violating SOLID Principles

### Single Responsibility Principle

- `bike-handler.php` handles routing, method validation, body parsing, service lookup, response shaping, sanitization, and error responses.
- `AccessoryService` handles filtering, validation, pricing, discount policy, inventory mutation, and response DTO construction.

### Open/Closed Principle

- Adding a new bike type requires editing handlers, adding service/repository files, adding branches in `rent`, adding UI logic, and likely adding reset logic.
- No polymorphic `BikeService` or `BikeRepository` abstraction exists.

### Liskov Substitution Principle

- There are no shared interfaces or base abstractions for bike services/repositories, so substitutability is absent.

### Interface Segregation Principle

- No interfaces exist. Consumers depend on concrete implementations with broader behavior than needed.

### Dependency Inversion Principle

- High-level services depend on concrete repositories.
- Handlers depend on static service locator access.
- Repository persistence mechanism is hardwired to files.

## 8. Areas Difficult To Scale

- File-based writes use full-file overwrite via `file_put_contents()` without locking or transactions.
- Concurrent rentals/orders can race and overwrite each other.
- Inventory state is stored in JSON/XML files, making horizontal scaling unsafe.
- Serialized `.cache` files are per-filesystem and unsuitable for multiple app servers.
- No optimistic locking, versioning, database constraints, or transactional stock deduction.
- Every request initializes all services, including services not used by that endpoint.
- No API routing layer, middleware, central validation, central exception handling, or observability.
- UI pages duplicate large amounts of JavaScript and markup between beach and mountain flows.
- Business rules are encoded as constants and hardcoded arrays, making promotions and inventory rules brittle.

## 9. Deprecated PHP Features

Confirmed deprecated or risky PHP-era features:

- `create_function()` in `services/AccessoryService.php`
  - Deprecated in PHP 7.2 and removed in PHP 8.0. Should be replaced with an anonymous closure.

- `each()` in `data/BeachCruiserRepository.php`
  - Deprecated in PHP 7.2 and removed in PHP 8.0. Should be replaced with `foreach`.

- `FILTER_SANITIZE_STRING` in `services/AccessoryService.php`
  - Deprecated in PHP 8.1. Should be replaced with explicit validation/escaping appropriate to context.

- Error suppression operator `@` around `json_decode()` in `handlers/bike-handler.php` and `handlers/accessory-handler.php`
  - Not deprecated, but legacy-style and hides useful diagnostics.

- `unserialize()` on local cache files in repositories
  - Not deprecated, but risky if cache files can ever be influenced externally. Prefer JSON cache, typed DTOs, or a real cache store.

## 10. Technical Debt Summary

This module is functional but highly legacy-oriented. The main debt is not just outdated PHP syntax; it is the lack of boundaries. UI, API shape, service logic, array schemas, file formats, cache behavior, and business rules are tightly connected.

Highest-risk debt:

- No transactional persistence for rentals or accessory stock.
- PHP 8 incompatibilities from `create_function()` and `each()`.
- Static service locator and manual includes.
- No domain model, typed contracts, or repository interfaces.
- Duplicated bike service and frontend logic.
- Inconsistent data naming conventions across bike types.
- Hardcoded reset data and promotion rules.
- No tests around rental, ordering, stock deduction, or cache behavior.

For enterprise integration, the first stabilization pass should replace deprecated PHP features, introduce interfaces for repositories/services, move response DTO shaping out of handlers, normalize data models, and replace file persistence with a transactional datastore.

## 11. Recommended Modernization Scope

The objective is to modernize the module while preserving existing business behavior and functionality.

### Planned Improvements

- Introduce Composer autoloading
- Implement PSR-4 namespaces
- Replace Service Locator with Dependency Injection
- Introduce Controller layer
- Add request validation
- Add centralized error handling
- Ensure PHP 8.3 compatibility
- Improve frontend UX and responsiveness
- Improve code organization and maintainability
- Add documentation and basic test coverage

### Out of Scope

- Full Laravel migration
- Complete framework rewrite
- Database migration
- Major feature additions
- Business logic redesign