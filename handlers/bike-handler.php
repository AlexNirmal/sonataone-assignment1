<?php
use BikeRental\Repositories\AccessoryRepository;
use BikeRental\Repositories\BeachCruiserRepository;
use BikeRental\Repositories\MountainBikeRepository;
use BikeRental\Services\AccessoryService;
use BikeRental\Services\BeachCruiserService;
use BikeRental\Services\MountainBikeService;

// Suppress deprecation notices and warnings so they don't corrupt the JSON output.
// PHP 7 is not shy about telling you things are deprecated. It will shout it directly
// into your response body, ruining the JSON and your afternoon simultaneously.
// E_ALL & ~E_DEPRECATED & ~E_NOTICE: still see real errors, just not the passive-aggressive ones.
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

/**
 * bike-handler.php
 *
 * IHttpHandler is gone. ApiController is gone. It's just a PHP file that outputs JSON.
 * The architecture diagram for this would be a single box labeled 'bike-handler.php'
 * with an arrow pointing to it labeled 'everything'.
 *
 * In .NET, routing lived in RouteConfig.cs, handlers in Web.config,
 * and the pipeline had HttpModules, HttpHandlers, and application lifecycle events
 * that nobody fully understood but everyone was afraid to touch.
 * Here, the browser sends a request. Apache finds this file. This file runs.
 * No pipeline. No handlers. No modules. Just vibes and file_get_contents.
 */

require_once __DIR__ . '/../vendor/autoload.php';

$dataFolder = __DIR__ . '/../SampleData';
$beachService = new BeachCruiserService(new BeachCruiserRepository($dataFolder));
$mountainService = new MountainBikeService(new MountainBikeRepository($dataFolder));
$accessoryService = new AccessoryService(new AccessoryRepository($dataFolder));

// Headers first. Always set headers before any output.
// PHP will let you forget this exactly once before delivering a "headers already sent"
// warning that points to line 1 of some file you didn't even know was loaded.
// Lesson learned the hard way by every PHP developer since approximately 2003.
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Dispatch on action. A switch statement. The original router.
// In .NET WebAPI this was attribute routing, model binding, and content negotiation.
// There were verbs and nouns and HTTP semantics to respect.
// Here it is: switch ($_GET['action']). Fast. Honest. Utterly without ceremony.
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {

    case 'beach':
        // GET: return all beach cruisers as JSON.
        // htmlspecialchars() on every string field because we are responsible developers
        // who have seen what happens when you aren't. We do not speak of it.
        // intval() instead of (int) cast — they do the same thing, intval() has more letters,
        // and old PHP code is full of it. Some habits are older than the deprecation system.
        $bikes = $beachService->getAll();
        $result = [];
        foreach ($bikes as $bike) {
            $result[] = [
                'bike_id'      => intval($bike['bike_id']),
                'model_name'   => htmlspecialchars($bike['model_name'],   ENT_QUOTES, 'UTF-8'),
                'color'        => htmlspecialchars($bike['color'],        ENT_QUOTES, 'UTF-8'),
                'frame_size'   => htmlspecialchars($bike['frame_size'],   ENT_QUOTES, 'UTF-8'),
                'daily_rate'   => floatval($bike['daily_rate']),
                'is_available' => (bool)$bike['is_available'],
            ];
        }
        echo json_encode($result);
        break;

    case 'mountain':
        // GET: return all mountain bikes as JSON.
        // PascalCase keys to match what the frontend expects, which matches the JSON source.
        // snake_case for beach cruisers, PascalCase for mountain bikes.
        // Consistency is a journey. We are still on the bus.
        $bikes = $mountainService->getAll();
        $result = [];
        foreach ($bikes as $bike) {
            $result[] = [
                'BikeID'         => intval($bike['BikeID']),
                'ModelName'      => htmlspecialchars($bike['ModelName'],      ENT_QUOTES, 'UTF-8'),
                'Brand'          => htmlspecialchars($bike['Brand'],          ENT_QUOTES, 'UTF-8'),
                'GearCount'      => intval($bike['GearCount']),
                'SuspensionType' => htmlspecialchars($bike['SuspensionType'], ENT_QUOTES, 'UTF-8'),
                'FrameMaterial'  => htmlspecialchars($bike['FrameMaterial'],  ENT_QUOTES, 'UTF-8'),
                'DailyRate'      => floatval($bike['DailyRate']),
                'IsAvailable'    => (bool)$bike['IsAvailable'],
                'Terrain'        => htmlspecialchars($bike['Terrain'],        ENT_QUOTES, 'UTF-8'),
                'WeightKg'       => floatval($bike['WeightKg']),
            ];
        }
        echo json_encode($result);
        break;

    case 'rent':
        // POST: rent a bike. Read JSON from request body.
        // Note the @ before json_decode. The @ operator suppresses errors.
        // It has been frowned upon since approximately PHP 4. It is here anyway.
        // It's the duct tape of PHP error handling: you know you shouldn't, but it holds.
        // We check json_last_error() nowhere. The @ just absorbs the screaming. Serene.
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['Success' => false, 'Message' => 'Method not allowed. POST only. This is not negotiable.']);
            break;
        }

        $body = file_get_contents('php://input');
        $data = @json_decode($body, true); // @ suppresses the parse error warning. Feels wrong. Works.

        if ($data === null) {
            http_response_code(400);
            echo json_encode(['Success' => false, 'Message' => 'Invalid JSON in request body.']);
            break;
        }

        $bikeType = isset($data['bikeType']) ? $data['bikeType'] : '';
        $bikeId   = isset($data['bikeId'])   ? intval($data['bikeId']) : 0;

        if ($bikeType === 'beach') {
            $success = $beachService->rentBike($bikeId);
        } elseif ($bikeType === 'mountain') {
            $success = $mountainService->rentBike($bikeId);
        } else {
            http_response_code(400);
            echo json_encode(['Success' => false, 'Message' => 'Unknown bikeType. Expected "beach" or "mountain". We do not offer "hovercraft".']);
            break;
        }

        if ($success) {
            echo json_encode(['Success' => true, 'Message' => 'Bike rented successfully. Enjoy the ride. Wear a helmet.']);
        } else {
            echo json_encode(['Success' => false, 'Message' => 'Bike is not available or does not exist. Both are equally sad.']);
        }
        break;

    case 'reset':
        // POST: reset all data to defaults.
        // The chaos button. The undo-everything button. The "pretend nothing happened" button.
        // In production, this endpoint would not exist.
        // This is not production. This is a bike rental demo with a PHP 7 backend
        // that is politely daring you to upgrade it. Take the hint.
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['Success' => false, 'Message' => 'Method not allowed.']);
            break;
        }

        $beachService->resetToDefaults();
        $mountainService->resetToDefaults();
        $accessoryService->resetToDefaults();

        echo json_encode(['Success' => true, 'Message' => 'All data reset to defaults. It is as if nothing happened. Nothing ever happened.']);
        break;

    default:
        http_response_code(400);
        echo json_encode(['Success' => false, 'Message' => 'Unknown action: ' . htmlspecialchars($action, ENT_QUOTES, 'UTF-8')]);
        break;
}
