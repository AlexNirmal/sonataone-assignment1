# Technical Debt Classification

# Critical

## File-Based Persistence Has No Transaction Or Locking Protection

- **Description:** Rentals and accessory orders read the full JSON/XML data file, mutate an in-memory array, and overwrite the full file using `file_put_contents()`. There is no file lock, transaction, version check, or rollback behavior.
- **Impact:** Concurrent requests can overwrite each other, causing lost rentals, incorrect availability, or incorrect accessory stock.
- **Risk:** High risk of data corruption if used by more than one user or deployed across multiple workers/servers.
- **Recommended Fix:** Replace file persistence with a transactional database. As an interim step, use exclusive file locks and atomic write/rename behavior.
- **Estimated Refactoring Effort:** High

## PHP 8 Incompatibility From Removed `create_function()`

- **Description:** `AccessoryService::getCompatibleWith()` uses `create_function()` to build a runtime filter callback.
- **Impact:** The code will fail on PHP 8.0+ because `create_function()` was removed.
- **Risk:** Blocks PHP 8.3 upgrade and introduces avoidable runtime code-generation risk.
- **Recommended Fix:** Replace `create_function()` with a normal anonymous closure using `function ($accessory) use ($bikeType)`.
- **Estimated Refactoring Effort:** Low

## PHP 8 Incompatibility From Removed `each()`

- **Description:** `BeachCruiserRepository::writeToXml()` uses `each()` with `reset()` to iterate over bikes.
- **Impact:** The code will fail on PHP 8.0+ because `each()` was removed.
- **Risk:** Blocks PHP 8.3 upgrade for any beach cruiser save or reset operation.
- **Recommended Fix:** Replace the `while ($entry = each($bikes))` loop with a standard `foreach ($bikes as $bike)` loop.
- **Estimated Refactoring Effort:** Low

## No Automated Tests For Core Business Behavior

- **Description:** There are no visible unit, integration, or API tests covering bike rental, accessory ordering, stock deduction, bundle discounts, reset behavior, cache behavior, or repository read/write behavior.
- **Impact:** Refactoring deprecated PHP features, persistence, services, or handlers has a high regression risk.
- **Risk:** High risk of silent breakage during modernization.
- **Recommended Fix:** Add focused tests around service behavior first, then repository read/write tests, then handler/API tests.
- **Estimated Refactoring Effort:** High

# High

## Static Service Locator Creates Hidden Global Coupling

- **Description:** `ApplicationServices` stores services in static properties and handlers access them globally after calling `initialize()`.
- **Impact:** Dependencies are hidden, lifecycle assumptions are implicit, and tests cannot easily substitute fake repositories or services.
- **Risk:** High maintainability risk as the module grows or is integrated into a larger enterprise application.
- **Recommended Fix:** Replace the static service locator with explicit dependency injection or a small request-scoped composition root.
- **Estimated Refactoring Effort:** Medium

## Handlers Mix Routing, Validation, Business Dispatch, Sanitization, And Serialization

- **Description:** `bike-handler.php` and `accessory-handler.php` directly inspect request methods and query parameters, parse JSON, call services, sanitize output, set headers, and emit JSON responses.
- **Impact:** Handler files are difficult to test and hard to extend with consistent validation, authorization, logging, or error handling.
- **Risk:** High risk of inconsistent API behavior and duplicated logic across future endpoints.
- **Recommended Fix:** Introduce controller-style functions/classes, request validation helpers, and centralized JSON response/error handling.
- **Estimated Refactoring Effort:** Medium

## Concrete Repository Dependencies Block Persistence Replacement

- **Description:** Services type-hint concrete repositories such as `BeachCruiserRepository`, `MountainBikeRepository`, and `AccessoryRepository`.
- **Impact:** Replacing file storage with a database requires changing service construction and concrete type hints.
- **Risk:** High modernization risk because persistence is tightly wired into business logic.
- **Recommended Fix:** Define repository interfaces and inject implementations through a bootstrap/composition layer.
- **Estimated Refactoring Effort:** Medium

## Associative Arrays Replace Domain Models

- **Description:** Bikes and accessories are passed through the system as associative arrays with storage-specific keys.
- **Impact:** Field names and casing leak across repositories, services, handlers, and frontend JavaScript.
- **Risk:** High risk of runtime notices, broken responses, and inconsistent behavior when schema changes.
- **Recommended Fix:** Introduce DTOs or domain objects for bikes, accessories, orders, and order results.
- **Estimated Refactoring Effort:** High

## Inconsistent API Field Naming

- **Description:** Beach cruisers use `snake_case` fields such as `bike_id`, while mountain bikes use `PascalCase` fields such as `BikeID`.
- **Impact:** The frontend contains separate rendering logic and cannot treat bikes uniformly.
- **Risk:** High maintainability risk when adding new bike types or shared UI components.
- **Recommended Fix:** Normalize API response DTOs to a consistent naming convention, preferably one independent of storage format.
- **Estimated Refactoring Effort:** Medium

## Business Rules Are Duplicated Between Frontend And Backend

- **Description:** Bundle IDs and discount calculation appear in frontend JavaScript and backend `AccessoryService`.
- **Impact:** Pricing displayed in the UI can diverge from server-calculated pricing.
- **Risk:** High business correctness risk if promotion rules change in one place but not the other.
- **Recommended Fix:** Move promotion calculation to the backend and return authoritative subtotal, discount, and total values to the UI.
- **Estimated Refactoring Effort:** Medium

## Manual Dependency Loading With `require_once`

- **Description:** Handlers and `ApplicationServices` manually include every service and repository file.
- **Impact:** File dependencies are noisy, error-prone, and difficult to scale as the module grows.
- **Risk:** High maintainability risk and poor fit for enterprise integration.
- **Recommended Fix:** Add Composer autoloading and namespaces, then remove manual include lists.
- **Estimated Refactoring Effort:** Medium

## Error Suppression Hides Runtime Problems

- **Description:** Handlers use `@json_decode()` and repositories tolerate parse/cache failures without clear diagnostics.
- **Impact:** Invalid request bodies, corrupt cache files, and malformed data can be difficult to debug.
- **Risk:** High operational risk because failures may appear as empty data or generic responses.
- **Recommended Fix:** Remove error suppression, check `json_last_error()`, and add structured error responses and logging.
- **Estimated Refactoring Effort:** Low

## No Centralized Security Boundary

- **Description:** Public handler files directly process state-changing requests. There is no authentication, authorization, CSRF protection, or central request validation visible in the module.
- **Impact:** Reset, rental, and accessory order operations are exposed to any caller that can reach the endpoints.
- **Risk:** High security risk if deployed beyond a local/demo context.
- **Recommended Fix:** Add authentication/authorization, CSRF protection for browser-originated state changes, and centralized request validation.
- **Estimated Refactoring Effort:** High

# Medium

## Deprecated `FILTER_SANITIZE_STRING`

- **Description:** `AccessoryService::getCompatibleWith()` uses `FILTER_SANITIZE_STRING`.
- **Impact:** This is deprecated in PHP 8.1 and unsuitable as a general validation strategy.
- **Risk:** Medium PHP 8.3 compatibility and input-handling risk.
- **Recommended Fix:** Validate `bikeType` against an allowlist such as `beach`, `mountain`, and `all` rather than sanitizing arbitrary strings.
- **Estimated Refactoring Effort:** Low

## Serialized Cache Files Couple Runtime State To PHP Internals

- **Description:** Repositories use `serialize()` and `unserialize()` for `.cache` files.
- **Impact:** Cache files are opaque, PHP-specific, and unsafe if externally influenced.
- **Risk:** Medium security and portability risk, especially in shared or multi-server environments.
- **Recommended Fix:** Remove the cache when moving to a database. If caching remains, use a standard cache store or JSON with explicit validation.
- **Estimated Refactoring Effort:** Medium

## Duplicate Bike Service Logic

- **Description:** `BeachCruiserService` and `MountainBikeService` have nearly identical `getAll()`, `rentBike()`, and `resetToDefaults()` patterns with different keys/default data.
- **Impact:** Fixes and behavior changes must be duplicated across bike types.
- **Risk:** Medium maintainability risk and high chance of drift between bike categories.
- **Recommended Fix:** Introduce a shared bike abstraction, common rental service, or normalized bike DTO.
- **Estimated Refactoring Effort:** Medium

## Duplicate Frontend Page Logic

- **Description:** `beach-cruisers.html` and `mountain-bikes.html` duplicate large amounts of CSS, modal markup, jQuery event handling, accessory rendering, order submission, and total calculation.
- **Impact:** UI changes and bug fixes must be repeated across pages.
- **Risk:** Medium maintainability risk and inconsistent user experience over time.
- **Recommended Fix:** Extract shared JavaScript and CSS into common assets, then parameterize bike-type-specific display fields.
- **Estimated Refactoring Effort:** Medium

## Hardcoded Reset Data

- **Description:** Bike reset defaults are hardcoded inside service methods, and accessory stock defaults are hardcoded in `AccessoryService`.
- **Impact:** Seed data is split between service code and sample data files.
- **Risk:** Medium maintainability risk when inventory defaults change.
- **Recommended Fix:** Move reset/default data into seed files or configuration and load it through repositories or seed services.
- **Estimated Refactoring Effort:** Medium

## Hardcoded Promotion Configuration

- **Description:** `AccessoryService` hardcodes bundle accessory IDs and discount rate as constants.
- **Impact:** Promotion changes require code changes and deployment.
- **Risk:** Medium business agility risk.
- **Recommended Fix:** Move promotions into configuration or a promotion policy repository/service.
- **Estimated Refactoring Effort:** Medium

## No Central Logging Or Observability

- **Description:** The PHP handlers and repositories do not log failed parses, failed writes, invalid requests, cache corruption, or service errors.
- **Impact:** Production diagnosis would rely on PHP/server logs and user reports.
- **Risk:** Medium operational risk.
- **Recommended Fix:** Add structured logging around request failures, persistence failures, and business-rule rejections.
- **Estimated Refactoring Effort:** Medium

## No Explicit Error Handling For File IO Failures

- **Description:** Repository `file_get_contents()`, `file_put_contents()`, `simplexml_load_file()`, and `json_encode()` calls do not consistently check failure results.
- **Impact:** Missing files, permission problems, invalid XML, failed writes, or failed JSON encoding can cause incorrect empty responses or broken persistence.
- **Risk:** Medium data consistency and supportability risk.
- **Recommended Fix:** Add explicit failure checks and throw/capture domain-specific persistence exceptions.
- **Estimated Refactoring Effort:** Medium

## Full-File Reads And Writes Do Not Scale

- **Description:** Each rental or order loads entire data files and overwrites entire files.
- **Impact:** Performance degrades as data grows, and writes become increasingly fragile.
- **Risk:** Medium scalability risk in current demo size, high if data volume grows.
- **Recommended Fix:** Move stateful operations to a database with indexed lookups and row-level updates.
- **Estimated Refactoring Effort:** High

## Response Sanitization Happens In API Handlers

- **Description:** Handlers call `htmlspecialchars()` before JSON encoding string fields.
- **Impact:** The API returns HTML-escaped data instead of raw JSON-safe values, mixing presentation escaping with API serialization.
- **Risk:** Medium correctness risk if clients need raw values or apply their own escaping.
- **Recommended Fix:** Return raw validated data from the API and perform HTML escaping at the point of DOM rendering, or use safe DOM APIs instead of string concatenation.
- **Estimated Refactoring Effort:** Medium

# Low

## Node Watcher Uses Deprecated Node APIs

- **Description:** `watch.js` uses legacy APIs such as `url.parse()`, `new Buffer()`, and `fs.exists()`.
- **Impact:** The watcher may emit deprecation warnings and is not aligned with modern Node.js practices.
- **Risk:** Low application risk because the watcher is a development helper, not core PHP request handling.
- **Recommended Fix:** Replace with `new URL()`, `Buffer.from()`, and `fs.access()` or direct unlink with error handling.
- **Estimated Refactoring Effort:** Low

## jQuery 1.12.4 Is End-Of-Life

- **Description:** The HTML pages load jQuery 1.12.4 from a CDN.
- **Impact:** The frontend depends on an old library and callback-style AJAX.
- **Risk:** Low to medium security and maintainability risk depending on deployment exposure.
- **Recommended Fix:** Upgrade jQuery or replace the small AJAX/event usage with modern browser APIs.
- **Estimated Refactoring Effort:** Medium

## No Package-Level PHP Dependency Management

- **Description:** The project has `package.json` but no `composer.json`.
- **Impact:** PHP dependencies, autoloading, PHP version constraints, and test tooling are not formally managed.
- **Risk:** Low current risk because the module has no external PHP dependencies, but medium modernization risk.
- **Recommended Fix:** Add `composer.json` with PHP version constraints, autoloading, and test/dev tooling.
- **Estimated Refactoring Effort:** Low

## Cache Invalidation Depends On File Modification Time

- **Description:** Repositories decide cache freshness using `filemtime()` comparisons.
- **Impact:** Cache correctness depends on filesystem timestamps.
- **Risk:** Low in local development, medium across networked filesystems or unusual deployment environments.
- **Recommended Fix:** Remove sidecar cache or use explicit cache keys/invalidation in a real cache store.
- **Estimated Refactoring Effort:** Medium

## Inline CSS And JavaScript In HTML Pages

- **Description:** The frontend pages contain large inline style and script blocks.
- **Impact:** Styling and behavior are difficult to share, test, cache, or maintain.
- **Risk:** Low immediate application risk, medium maintainability risk.
- **Recommended Fix:** Extract shared CSS and JavaScript into versioned static assets.
- **Estimated Refactoring Effort:** Medium

## Informal Error Messages In API Responses

- **Description:** Several API messages contain informal demo-oriented wording.
- **Impact:** Responses are not suitable for enterprise audit trails, support workflows, or consistent client handling.
- **Risk:** Low functional risk, medium professionalism/integration risk.
- **Recommended Fix:** Return stable machine-readable error codes plus concise user-safe messages.
- **Estimated Refactoring Effort:** Low

# Technical Debt Prioritization Roadmap

## Immediate Fixes

- Replace `create_function()` with a closure to unblock PHP 8+ compatibility.
- Replace `each()` with `foreach` to unblock PHP 8+ compatibility.
- Replace `FILTER_SANITIZE_STRING` with explicit allowlist validation for `bikeType`.
- Remove `@json_decode()` and check `json_last_error()`.
- Add explicit checks for failed `file_get_contents()`, `file_put_contents()`, `simplexml_load_file()`, and `json_encode()`.
- Add a minimal regression test suite for bike rental, accessory ordering, stock validation, bundle discount, and reset behavior.

## Short-Term Improvements

- Add Composer autoloading and namespaces.
- Introduce repository interfaces and inject dependencies through a small composition root instead of static `ApplicationServices`.
- Normalize API response shapes for all bike types.
- Extract duplicated frontend JavaScript and CSS from `beach-cruisers.html` and `mountain-bikes.html`.
- Move promotion calculation fully to the backend and return authoritative totals to the UI.
- Add centralized JSON response helpers, validation helpers, and structured error responses.
- Add basic logging for invalid requests, persistence failures, and cache corruption.

## Long-Term Improvements

- Replace JSON/XML file persistence with a transactional database.
- Model bikes, accessories, orders, rental state, pricing, and discounts as typed domain objects or DTOs.
- Split procedural handlers into controller classes or a lightweight routing framework.
- Add authentication, authorization, and CSRF protection before exposing state-changing operations.
- Replace serialized cache sidecars with a real cache strategy or remove caching after database migration.
- Create integration/API tests and repository tests to support enterprise-scale refactoring.
- Consolidate bike rental behavior behind a common bike service/domain abstraction.
