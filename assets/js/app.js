/* PedalPal Shared Application Logic
 * Common utilities and bike rental workflow shared across all pages
 * Configuration (colors, API endpoints, bike types) is passed in at initialization
 */

var BikeRental = (function() {
    'use strict';

    // Private state
    var config = null;
    var currentBikeId = null;
    var accessories = [];
    var lastActiveElement = null;
    var orderJustSubmitted = false;  // Track if we should suppress rental confirmation toast

    function ensureToastContainer() {
        if ($('#toastContainer').length === 0) {
            $('body').append(
                '<div id="toastContainer" class="toast-container" aria-live="polite" aria-atomic="true"></div>'
            );
        }
    }

    function showToast(message, type) {
        ensureToastContainer();
        var toastClass = 'toast';
        if (type === 'error') {
            toastClass += ' toast-error';
        } else if (type === 'success') {
            toastClass += ' toast-success';
        } else {
            toastClass += ' toast-info';
        }

        var $toast = $('<div>')
            .addClass(toastClass)
            .attr('role', 'status')
            .attr('aria-live', 'polite')
            .text(message);

        $('#toastContainer').append($toast);

        setTimeout(function() {
            $toast.addClass('show');
        }, 10);

        setTimeout(function() {
            $toast.removeClass('show');
            setTimeout(function() {
                $toast.remove();
            }, 300);
        }, 3800);
    }

    function setPageAlert(message, type) {
        var $alert = $('#pageAlert');
        if ($alert.length === 0) {
            return;
        }
        if (!message) {
            $alert.hide().text('').removeClass('alert-error alert-info');
            return;
        }
        $alert.removeClass('alert-error alert-info')
            .addClass(type === 'error' ? 'alert-error' : 'alert-info')
            .text(message)
            .show();
    }

    function showModalError(message) {
        var $error = $('#modalErrorMsg');
        if ($error.length === 0) {
            return;
        }
        $error.text(message).show();
    }

    function clearModalError() {
        $('#modalErrorMsg').hide().text('');
    }

    // Public API
    return {
        /**
         * Initialize the bike rental workflow.
         * Must be called once on page load with configuration object.
         *
         * @param {Object} cfg Configuration with:
         *   - bikeType: 'beach' or 'mountain'
         *   - bundleIds: [id1, id2] for bundle discount
         *   - bikeHandlerUrl: URL to bike handler
         *   - accessoryHandlerUrl: URL to accessory handler
         *   - onBikeRender: callback(bikes, cfg) to render bikes
         *   - onAccessoriesRender: callback(accessories) to render accessories
         *   - snakeCase: boolean, whether bike data uses snake_case or PascalCase
         */
        init: function(cfg) {
            config = cfg;
            currentBikeId = null;
            accessories = [];

            // Register event handlers (once, at startup)
            $('#modalClose').on('click', BikeRental.closeModal);
            $('#skipAccessoriesBtn').on('click', function() {
                BikeRental.closeModal();
                BikeRental.refreshBikes();
            });
            $('#confirmOrderBtn').on('click', function() {
                BikeRental.submitOrder();
            });

            // Delegated quantity button handlers
            $('#accessoryList').on('click', '.qty-btn-minus', function() {
                var id = parseInt($(this).data('id'), 10);
                BikeRental.adjustQty(id, -1);
            });
            $('#accessoryList').on('click', '.qty-btn-plus', function() {
                var id = parseInt($(this).data('id'), 10);
                BikeRental.adjustQty(id, +1);
            });

            // Modal backdrop click to close
            $('#accessoryModal').on('click', function(e) {
                if ($(e.target).is('#accessoryModal')) {
                    BikeRental.closeModal();
                    BikeRental.refreshBikes();
                }
            });

            // Keyboard close support
            $(document).on('keydown', function(e) {
                if (e.which === 27 && $('#accessoryModal').hasClass('active')) {
                    BikeRental.closeModal();
                    BikeRental.refreshBikes();
                }
            });

            // Load bikes on init
            BikeRental.loadBikes();
        },

        /**
         * Load bikes from the API
         */
        loadBikes: function() {
            setPageAlert('');
            $('#bikesContainer').html(
                '<div class="loading-msg" role="status" aria-live="polite">' +
                '<span class="spinner" aria-hidden="true"></span> Loading bikes...</div>'
            );

            $.ajax({
                url: config.bikeHandlerUrl + '?action=' + config.bikeType,
                method: 'GET',
                dataType: 'json',
                success: function(bikes) {
                    if (config.onBikeRender) {
                        config.onBikeRender(bikes, config);
                    }
                },
                error: function() {
                    var message = 'Failed to load bikes. The PHP server may not be running.';
                    $('#bikesContainer').html(
                        '<div class="error-msg" role="alert">' + message + '</div>'
                    );
                    setPageAlert(message, 'error');
                    showToast(message, 'error');
                }
            });
        },

        /**
         * Refresh bikes (reload from API)
         */
        refreshBikes: function() {
            BikeRental.loadBikes();
        },

        /**
         * Rent a bike by ID
         */
        rentBike: function(bikeId) {
            $.ajax({
                url: config.bikeHandlerUrl + '?action=rent',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ bikeType: config.bikeType, bikeId: bikeId }),
                dataType: 'json',
                success: function(response) {
                    if (response.Success) {
                        currentBikeId = bikeId;
                        BikeRental.openAccessoryModal(bikeId);
                        BikeRental.refreshBikes(); // refresh in background
                    } else {
                        var message = 'Could not rent bike: ' + response.Message;
                        setPageAlert(message, 'error');
                        showToast(message, 'error');
                        BikeRental.refreshBikes();
                    }
                },
                error: function() {
                    var message = 'Failed to rent bike. Check that the PHP server is running.';
                    setPageAlert(message, 'error');
                    showToast(message, 'error');
                }
            });
        },

        /**
         * Open the accessory modal for a rented bike
         */
        openAccessoryModal: function(bikeId) {
            lastActiveElement = document.activeElement;
            currentBikeId = bikeId;

            clearModalError();
            setPageAlert('');

            // Reset modal state
            $('#accessoryList').html(
                '<div class="loading-msg" role="status" aria-live="polite">' +
                '<span class="spinner" aria-hidden="true"></span> Loading accessories...</div>'
            );
            $('#modalSubtitle').text('Rented! Would you like to add anything?');
            $('#bundleBanner').removeClass('active');
            $('#subtotalLine').hide();
            $('#discountLine').hide();
            $('#totalVal').text('$0.00');
            $('#confirmOrderBtn').prop('disabled', true);
            $('#orderSuccessMsg').hide();
            $('#confirmOrderBtn').show().text('Confirm Order');
            $('#skipAccessoriesBtn').show();
            $('#accessoryModal .modal').attr('aria-busy', 'true');
            $('#accessoryModal').addClass('active');
            $('#modalClose').focus();

            // Fetch accessories for this bike type
            $.ajax({
                url: config.accessoryHandlerUrl + '?bikeType=' + config.bikeType,
                method: 'GET',
                dataType: 'json',
                success: function(data) {
                    accessories = data;
                    // Initialize quantities to 0
                    $.each(accessories, function(i, acc) {
                        acc._qty = 0;
                    });
                    if (config.onAccessoriesRender) {
                        config.onAccessoriesRender(accessories);
                    }
                    $('#accessoryModal .modal').removeAttr('aria-busy');
                },
                error: function() {
                    var message = 'Failed to load accessories.';
                    $('#accessoryList').html(
                        '<div class="error-msg" role="alert">' + message + '</div>'
                    );
                    showModalError(message);
                    showToast(message, 'error');
                    $('#accessoryModal .modal').removeAttr('aria-busy');
                }
            });
        },

        /**
         * Close the accessory modal and reset state
         */
        closeModal: function() {
            var wasOrderJustSubmitted = orderJustSubmitted;
            var hadBikeId = currentBikeId !== null;
            
            $('#accessoryModal').removeClass('active');
            $('#accessoryModal .modal').removeAttr('aria-busy');
            $('#accessoryList').show();
            $('#confirmOrderBtn').show().text('Confirm Order');
            $('#skipAccessoriesBtn').show();
            $('#orderSuccessMsg').hide();
            clearModalError();
            currentBikeId = null;
            accessories = [];
            orderJustSubmitted = false;  // Reset flag
            
            if (lastActiveElement && $(lastActiveElement).length) {
                $(lastActiveElement).focus();
            }
            lastActiveElement = null;
            
            // Show rental confirmation toast only if we didn't just submit an order
            if (!wasOrderJustSubmitted && hadBikeId) {
                showToast('Bike rental confirmed.', 'success');
            }
        },

        /**
         * Adjust quantity for an accessory
         */
        adjustQty: function(accessoryId, delta) {
            var acc = BikeRental.getAccessoryById(accessoryId);
            if (!acc) return;

            var newQty = (acc._qty || 0) + delta;
            if (newQty < 0) newQty = 0;
            if (newQty > acc.StockCount) newQty = acc.StockCount;

            acc._qty = newQty;
            $('#qty-' + accessoryId).text(newQty);
            BikeRental.updateTotals();
        },

        /**
         * Get an accessory by ID
         */
        getAccessoryById: function(id) {
            for (var i = 0; i < accessories.length; i++) {
                if (accessories[i].AccessoryID === id) return accessories[i];
            }
            return null;
        },

        /**
         * Update total price and bundle discount display
         */
        updateTotals: function() {
            var subtotal = 0;
            var hasItems = false;
            var bundleA = false;  // First bundle ID
            var bundleB = false;  // Second bundle ID

            $.each(accessories, function(i, acc) {
                var qty = acc._qty || 0;
                if (qty > 0) {
                    subtotal += acc.UnitPrice * qty;
                    hasItems = true;
                    if (acc.AccessoryID === config.bundleIds[0]) bundleA = true;
                    if (acc.AccessoryID === config.bundleIds[1]) bundleB = true;
                }
            });

            var bundleApplied = bundleA && bundleB;
            var discountAmount = bundleApplied ? Math.round(subtotal * 0.10 * 100) / 100 : 0;
            var total = Math.round((subtotal - discountAmount) * 100) / 100;

            if (hasItems) {
                $('#subtotalLine').show();
                $('#subtotalVal').text('$' + subtotal.toFixed(2));
            } else {
                $('#subtotalLine').hide();
            }

            if (bundleApplied) {
                $('#bundleBanner').addClass('active');
                $('#discountLine').show();
                $('#discountVal').text('-$' + discountAmount.toFixed(2));
            } else {
                $('#bundleBanner').removeClass('active');
                $('#discountLine').hide();
            }

            $('#totalVal').text('$' + total.toFixed(2));
            $('#confirmOrderBtn').prop('disabled', !hasItems);
        },

        /**
         * Submit the accessory order
         */
        submitOrder: function() {
            var orderItems = [];
            $.each(accessories, function(i, acc) {
                if (acc._qty > 0) {
                    orderItems.push({ AccessoryID: acc.AccessoryID, Quantity: acc._qty });
                }
            });

            if (orderItems.length === 0) {
                BikeRental.closeModal();
                return;
            }

            $('#confirmOrderBtn').prop('disabled', true).text('Processing...');

            $.ajax({
                url: config.accessoryHandlerUrl,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(orderItems),
                dataType: 'json',
                success: function(response) {
                    if (response.Success) {
                        orderJustSubmitted = true;  // Mark that we should not show rental toast
                        var detail = response.Message;
                        if (response.BundleDiscountApplied) {
                            detail += ' Total: $' + response.TotalPrice.toFixed(2) +
                                ' (saved $' + response.DiscountAmount.toFixed(2) + ')';
                        } else {
                            detail += ' Total: $' + response.TotalPrice.toFixed(2);
                        }
                        $('#orderSuccessDetail').text(detail);
                        $('#accessoryList').hide();
                        $('#bundleBanner').hide();
                        $('.total-section').hide();
                        $('#confirmOrderBtn').hide();
                        $('#skipAccessoriesBtn').hide();
                        $('#orderSuccessMsg').show();

                        setTimeout(function() {
                            BikeRental.closeModal();
                        }, 3500);
                    } else {
                        var message = 'Order failed: ' + response.Message;
                        showModalError(message);
                        showToast(message, 'error');
                        $('#confirmOrderBtn').prop('disabled', false).text('Confirm Order');
                    }
                },
                error: function() {
                    var message = 'Failed to submit order.';
                    showModalError(message);
                    showToast(message, 'error');
                    $('#confirmOrderBtn').prop('disabled', false).text('Confirm Order');
                }
            });
        },

        /**
         * Get current accessories array (for page-specific rendering)
         */
        getAccessories: function() {
            return accessories;
        }
    };
})();
