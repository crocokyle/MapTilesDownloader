var mapView;

        $(function() {

            var map = null;
            var drawControl = null;
            var bar = null;
            var gridLayer = null;

            var cancellationToken = false;
            var requests = [];

            var sources = {
                "Open Street Maps": "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "Open Cycle Maps": "http://a.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png",
                "Open PT Transport": "http://openptmap.org/tiles/{z}/{x}/{y}.png",
                "ESRI World Imagery": "http://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                "Wikimedia Maps": "https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png",
                "NASA GIBS": "https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_CorrectedReflectance_TrueColor/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
                "Carto Light": "http://cartodb-basemaps-c.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png",
                "Stamen Toner B&W": "http://a.tile.stamen.com/toner/{z}/{x}/{y}.png",
            };

            // This function replaces the Mapbox initialization with Leaflet.js
            function initializeMap() {
                // Initialize the map with Leaflet.js, centering on New York
                map = L.map('map-view').setView([40.755024, -73.983652], 12);

                // Add a default tile layer (OpenStreetMap)
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);
            }

            // Simple dropdown logic, since we are not using Materialize
            function initializeSources() {
                var dropdown = $("#sources");
                var trigger = $(".dropdown-trigger");
                
                trigger.on('click', function() {
                    dropdown.toggle();
                });

                $(document).on('click', function(event) {
                    if (!$(event.target).closest('.dropdown-trigger, .dropdown-content').length) {
                        dropdown.hide();
                    }
                });

                for(var key in sources) {
                    var url = sources[key];
                    if(url == "") {
                        dropdown.append("<hr/>");
                        continue;
                    }
                    var item = $("<li><a></a></li>");
                    item.attr("data-url", url);
                    item.find("a").text(key);
                    item.click(function() {
                        var url = $(this).attr("data-url");
                        $("#source-box").val(url);
                        dropdown.hide();
                    });
                    dropdown.append(item);
                }
            }

            // Geocoder search function using Nominatim
            function initializeSearch() {
                $("#search-form").submit(function(e) {
                    e.preventDefault();
                    var location = $("#location-box").val();
                    if (!location) {
                        return;
                    }

                    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
                    
                    fetch(nominatimUrl)
                        .then(response => response.json())
                        .then(data => {
                            if (data && data.length > 0) {
                                const result = data[0];
                                const bounds = [[result.boundingbox[0], result.boundingbox[2]], [result.boundingbox[1], result.boundingbox[3]]];
                                map.fitBounds(bounds);
                            } else {
                                alert('Location not found.');
                            }
                        })
                        .catch(error => {
                            console.error('Error fetching geocoding data:', error);
                            alert('An error occurred during search. Please try again.');
                        });
                });
            }

            // Unused in this updated version as all options are visible.
            function initializeMoreOptions() {
                // This function is no longer needed as the UI is simplified
            }

            // Initializes the Leaflet.draw control for drawing a rectangle.
            function initializeRectangleTool() {
                drawControl = new L.Control.Draw({
                    position: 'topleft',
                    draw: {
                        polygon: false,
                        polyline: false,
                        circle: false,
                        marker: false,
                        circlemarker: false,
                        rectangle: {
                            shapeOptions: {
                                color: '#fa8231'
                            }
                        }
                    },
                    edit: {
                        featureGroup: L.featureGroup().addTo(map)
                    }
                });
                map.addControl(drawControl);

                map.on(L.Draw.Event.CREATED, function (e) {
                    alert('Rectangle drawn!');
                });
                
                // Hide the default Leaflet.draw toolbar, we only want the button.
                $(".leaflet-draw-toolbar").hide();

                $("#rectangle-draw-button").click(function() {
                    startDrawing();
                });

            }

            function startDrawing() {
                removeGrid();
                if(drawControl && drawControl.setDrawingOptions) {
                    drawControl.disable(); // Stop any previous drawing
                }
                new L.Draw.Rectangle(map, drawControl.options.rectangle).enable();
                alert('Click two points on the map to make a rectangle.');
            }

            function initializeGridPreview() {
                $("#grid-preview-button").click(previewGrid);
                map.on('click', showTilePopup);
            }

            function showTilePopup(e) {
                if (!e.originalEvent.ctrlKey) {
                    return;
                }
                var maxZoom = getMaxZoom();
                var latlng = e.latlng;
                var x = long2tile(latlng.lng, maxZoom);
                var y = lat2tile(latlng.lat, maxZoom);
                var content = "X, Y, Z<br/><b>" + x + ", " + y + ", " + maxZoom + "</b><hr/>";
                content += "Lat, Lng<br/><b>" + latlng.lat.toFixed(6) + ", " + latlng.lng.toFixed(6) + "</b>";

                L.popup()
                    .setLatLng(latlng)
                    .setContent(content)
                    .openOn(map);
            }
            
            // The following functions are for tile calculations and geometry,
            // they remain largely the same, but now use Leaflet's L.latLng and L.latLngBounds
            function long2tile(lon, zoom) {
                return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
            }

            function lat2tile(lat, zoom) {
                return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
            }

            function tile2long(x, z) {
                return (x / Math.pow(2, z) * 360 - 180);
            }

            function tile2lat(y, z) {
                var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
                return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
            }

            function getTileRect(x, y, zoom) {
                var southWest = L.latLng(tile2lat(y + 1, zoom), tile2long(x, zoom));
                var northEast = L.latLng(tile2lat(y, zoom), tile2long(x + 1, zoom));
                return L.latLngBounds(southWest, northEast);
            }

            function getMinZoom() {
                return Math.min(parseInt($("#zoom-from-box").val()), parseInt($("#zoom-to-box").val()));
            }

            function getMaxZoom() {
                return Math.max(parseInt($("#zoom-from-box").val()), parseInt($("#zoom-to-box").val()));
            }

            function getArrayByBounds(bounds) {
                return [
                    [bounds.getSouthWest().lng, bounds.getNorthEast().lat],
                    [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
                    [bounds.getNorthEast().lng, bounds.getSouthWest().lat],
                    [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
                    [bounds.getSouthWest().lng, bounds.getNorthEast().lat],
                ];
            }

            function getPolygonByBounds(bounds) {
                var tilePolygonData = getArrayByBounds(bounds);
                return turf.polygon([tilePolygonData]);
            }

            function isTileInSelection(tileRect) {
                var polygon = getPolygonByBounds(tileRect);
                var drawnItems = drawControl.options.edit.featureGroup.getLayers();
                if (drawnItems.length === 0) return false;
                var areaPolygon = drawnItems[0].toGeoJSON();
                return turf.booleanDisjoint(polygon, areaPolygon) === false;
            }

            function getBounds() {
                var drawnItems = drawControl.options.edit.featureGroup.getLayers();
                if (drawnItems.length === 0) return null;
                return drawnItems[0].getBounds();
            }

            function getGrid(zoomLevel) {
                var bounds = getBounds();
                if (!bounds) return [];
                
                var rects = [];
                var thisZoom = zoomLevel;

                var northY = lat2tile(bounds.getNorthEast().lat, thisZoom);
                var westX = long2tile(bounds.getSouthWest().lng, thisZoom);
                var southY = lat2tile(bounds.getSouthWest().lat, thisZoom);
                var eastX = long2tile(bounds.getNorthEast().lng, thisZoom);

                for (var y = northY; y <= southY; y++) {
                    for (var x = westX; x <= eastX; x++) {
                        var rect = getTileRect(x, y, thisZoom);
                        if (isTileInSelection(rect)) {
                            rects.push({ x: x, y: y, z: thisZoom, rect: rect });
                        }
                    }
                }
                return rects;
            }

            function getAllGridTiles() {
                var allTiles = [];
                for (var z = getMinZoom(); z <= getMaxZoom(); z++) {
                    var grid = getGrid(z);
                    allTiles = allTiles.concat(grid);
                }
                return allTiles;
            }

            function removeGrid() {
                if (gridLayer) {
                    map.removeLayer(gridLayer);
                    gridLayer = null;
                }
            }

            function previewGrid() {
                var maxZoom = getMaxZoom();
                var grid = getGrid(maxZoom);
                var polygons = grid.map(feature => getPolygonByBounds(feature.rect));

                removeGrid();
                
                gridLayer = L.geoJSON(turf.featureCollection(polygons), {
                    style: {
                        color: "#fa8231",
                        weight: 3,
                        opacity: 0.8,
                        fillOpacity: 0
                    }
                }).addTo(map);

                var totalTiles = getAllGridTiles().length;
                alert('Total ' + totalTiles.toLocaleString() + ' tiles in the region.');
            }

            function previewRect(rectInfo) {
                var array = getArrayByBounds(rectInfo.rect);
                var geojson = turf.polygon([array]);
                var layer = L.geoJSON(geojson, {
                    style: {
                        color: "#ff9f1a",
                        weight: 3,
                        opacity: 0.8,
                        fillOpacity: 0
                    }
                }).addTo(map);
                return layer;
            }

            function generateQuadKey(x, y, z) {
                var quadKey = [];
                for (var i = z; i > 0; i--) {
                    var digit = '0';
                    var mask = 1 << (i - 1);
                    if ((x & mask) != 0) {
                        digit++;
                    }
                    if ((y & mask) != 0) {
                        digit++;
                        digit++;
                    }
                    quadKey.push(digit);
                }
                return quadKey.join('');
            }
            
            function initializeDownloader() {
                bar = new ProgressBar.Circle($('#progress-radial').get(0), {
                    strokeWidth: 12,
                    easing: 'easeOut',
                    duration: 200,
                    trailColor: '#eee',
                    trailWidth: 1,
                    from: {color: '#0fb9b1', a:0},
                    to: {color: '#20bf6b', a:1},
                    svgStyle: null,
                    step: function(state, circle) {
                        circle.path.setAttribute('stroke', state.color);
                    }
                });
                $("#download-button").click(startDownloading);
                $("#stop-button").click(stopDownloading);
            }

            function showTinyTile(base64) {
                var currentImages = $(".tile-strip img");
                for (var i = 4; i < currentImages.length; i++) {
                    $(currentImages[i]).remove();
                }
                var image = $("<img/>").attr('src', "data:image/png;base64, " + base64).addClass('w-20 h-20 rounded-md mx-1 shadow');
                var strip = $(".tile-strip");
                strip.prepend(image);
            }

            async function startDownloading() {
                var drawnItems = drawControl.options.edit.featureGroup.getLayers();
                if (drawnItems.length == 0) {
                    alert('You need to select a region first.');
                    return;
                }
                cancellationToken = false;
                requests = [];
                $("#main-sidebar").hide();
                $("#download-sidebar").show();
                $(".tile-strip").html("");
                $("#stop-button").html("STOP");
                removeGrid();
                clearLogs();
                // A simple replacement for M.toast.dismissAll
                alert(''); 
                var allTiles = getAllGridTiles();
                updateProgress(0, allTiles.length);
                var numThreads = 5; // Fixed number of threads for this example
                var source = $("#source-box").val();
                
                logItemRaw("Downloading tiles locally (simulated)...");
                let i = 0;
                var iterator = async.eachLimit(allTiles, numThreads, function(item, done) {
                    if (cancellationToken) {
                        return;
                    }
                    var boxLayer = previewRect(item);
                    // Simulate a download by waiting for a short period
                    setTimeout(() => {
                        if (cancellationToken) {
                            return;
                        }
                        // Simulate a successful download
                        logItem(item.x, item.y, item.z, "Simulated download complete.");
                        removeLayer(boxLayer);
                        i++;
                        updateProgress(i, allTiles.length);
                        done();
                    }, 500);

                }, async function(err) {
                    updateProgress(allTiles.length, allTiles.length);
                    logItemRaw("All simulated downloads are done");
                    $("#stop-button").html("FINISH");
                });
            }

            function updateProgress(value, total) {
                var progress = total > 0 ? value / total : 0;
                bar.animate(progress);
                bar.setText(Math.round(progress * 100) + '<span>%</span>');
                $("#progress-subtitle").html(value.toLocaleString() + " <span>out of</span> " + total.toLocaleString());
            }

            function logItem(x, y, z, text) {
                logItemRaw(x + ',' + y + ',' + z + ' : ' + text);
            }

            function logItemRaw(text) {
                var logger = $('#log-view');
                logger.val(logger.val() + '\n' + text);
                logger.scrollTop(logger[0].scrollHeight);
            }

            function clearLogs() {
                var logger = $('#log-view');
                logger.val('');
            }

            function stopDownloading() {
                cancellationToken = true;
                // No need to abort requests in the simulated version
                $("#main-sidebar").show();
                $("#download-sidebar").hide();
                removeGrid();
                clearLogs();
            }

            // Initialization calls
            initializeMap();
            initializeSources();
            initializeSearch();
            initializeRectangleTool();
            initializeGridPreview();
            initializeDownloader();
        });
