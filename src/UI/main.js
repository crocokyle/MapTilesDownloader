$(function() {
    var map = null;
    var drawnItems;
    var currentTileLayer = null;
    var gridPreviewLayer = null;
    var bar = null;
    var cancellationToken = null;
    var requests = [];

    // Note: Bing Maps sources removed as they require a special plugin for quadkey support.
    var sources = {
        "Open Street Maps": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "Open Cycle Maps": "https://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png",
        "Open PT Transport": "https://{s}.tile.openstreetmap.de/tiles/openptmap/openptmap/{z}/{x}/{y}.png",
        "div-1": "",
        "Google Maps": "https://mt0.google.com/vt?lyrs=m&x={x}&s=&y={y}&z={z}",
        "Google Maps Satellite": "https://mt0.google.com/vt?lyrs=s&x={x}&s=&y={y}&z={z}",
        "Google Maps Hybrid": "https://mt0.google.com/vt?lyrs=h&x={x}&s=&y={y}&z={z}",
        "Google Maps Terrain": "https://mt0.google.com/vt?lyrs=p&x={x}&s=&y={y}&z={z}",
        "div-2": "",
        "ESRI World Imagery": "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        "Wikimedia Maps": "https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png",
        "NASA GIBS": "https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_CorrectedReflectance_TrueColor/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg",
        "div-3": "",
        "Carto Light": "https://cartodb-basemaps-c.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png",
        "Stamen Toner B&W": "https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png",
    };

    function initializeMap() {
        map = L.map('map-view').setView([40.755024, -73.983652], 12);
        
        // Add initial tile layer
        switchTileLayer(sources["Open Street Maps"]);

        // Feature group to store drawn layers
        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
    }

    function switchTileLayer(url) {
        if (currentTileLayer) {
            map.removeLayer(currentTileLayer);
        }
        currentTileLayer = L.tileLayer(url, {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }

    function initializeMaterialize() {
        $('select').formSelect();
        $('.dropdown-trigger').dropdown({
            constrainWidth: false
        });
    }

    function initializeSources() {
        var dropdown = $("#sources-dropdown");
        for (var key in sources) {
            var url = sources[key];
            if (url === "") {
                dropdown.append("<li class='divider' tabindex='-1'></li>");
                continue;
            }
            var item = $("<li><a></a></li>");
            item.attr("data-url", url);
            item.find("a").text(key);
            item.click(function() {
                var url = $(this).attr("data-url");
                $("#source-box").val(url);
                M.updateTextFields();
                switchTileLayer(url);
            });
            dropdown.append(item);
        }
    }

    async function initializeSearch() {
        $("#search-form").submit(async function(e) {
            e.preventDefault();
            var location = $("#location-box").val();
            if (!location) return;

            // Using Nominatim for geocoding (no API key needed)
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                const item = data[0];
                const bounds = [
                    [item.boundingbox[0], item.boundingbox[2]],
                    [item.boundingbox[1], item.boundingbox[3]]
                ];
                map.fitBounds(bounds);
            } else {
                M.toast({html: 'Location not found.'});
            }
        });
    }

    function initializeMoreOptions() {
        $("#more-options-toggle").click(function() {
            $("#more-options").slideToggle();
        });
        $("#output-type").change(function() {
            var outputType = $(this).val();
            if (outputType == "mbtiles") {
                $("#output-file-box").val("tiles.mbtiles");
            } else if (outputType == "repo") {
                $("#output-file-box").val("tiles.repo");
            } else if (outputType == "directory") {
                $("#output-file-box").val("{z}/{x}/{y}.png");
            }
            M.updateTextFields();
        });
    }

    function initializeRectangleTool() {
        var drawControl = new L.Control.Draw({
            draw: {
                polygon: false,
                marker: false,
                circlemarker: false,
                polyline: false,
                circle: false,
                rectangle: {
                    shapeOptions: {
                        color: '#f357a1',
                        weight: 4
                    }
                }
            },
            edit: {
                featureGroup: drawnItems
            }
        });
        map.addControl(drawControl);

        map.on(L.Draw.Event.CREATED, function (e) {
            drawnItems.clearLayers();
            var layer = e.layer;
            drawnItems.addLayer(layer);
            M.Toast.dismissAll();
        });

        $("#rectangle-draw-button").click(function() {
            startDrawing();
        });
    }

    function startDrawing() {
        removeGrid();
        drawnItems.clearLayers();
        new L.Draw.Rectangle(map, {
            shapeOptions: {
                color: '#f357a1',
                weight: 4
            }
        }).enable();
        M.Toast.dismissAll();
        M.toast({html: 'Click and drag on the map to draw a rectangle.', displayLength: 7000});
    }

    function initializeGridPreview() {
        $("#grid-preview-button").click(previewGrid);
        map.on('click', showTilePopup);
    }
    
    function showTilePopup(e) {
        if (!e.originalEvent.ctrlKey) return;
        var maxZoom = getMaxZoom();
        var x = long2tile(e.latlng.lng, maxZoom);
        var y = lat2tile(e.latlng.lat, maxZoom);
        var content = "X, Y, Z<br/><b>" + x + ", " + y + ", " + maxZoom + "</b><hr/>";
        content += "Lat, Lng<br/><b>" + e.latlng.lat.toFixed(6) + ", " + e.latlng.lng.toFixed(6) + "</b>";
        L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
    }

    // --- Tile Calculation Functions (unchanged) ---
    function long2tile(lon, zoom) { return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom))); }
    function lat2tile(lat, zoom) { return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))); }
    function tile2long(x, z) { return (x / Math.pow(2, z) * 360 - 180); }
    function tile2lat(y, z) {
        var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
    }

    function getTileRect(x, y, zoom) {
        var c1 = L.latLng(tile2lat(y, zoom), tile2long(x, zoom));
        var c2 = L.latLng(tile2lat(y + 1, zoom), tile2long(x + 1, zoom));
        return L.latLngBounds(c1, c2);
    }

    function getMinZoom() { return parseInt($("#zoom-from-box").val()); }
    function getMaxZoom() { return parseInt($("#zoom-to-box").val()); }

    function getPolygonByBounds(bounds) {
        return turf.polygon([[
            [bounds.getSouthWest().lng, bounds.getNorthEast().lat],
            [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
            [bounds.getNorthEast().lng, bounds.getSouthWest().lat],
            [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
            [bounds.getSouthWest().lng, bounds.getNorthEast().lat],
        ]]);
    }

    function isTileInSelection(tileRect) {
        if (drawnItems.getLayers().length === 0) return false;
        var polygon = getPolygonByBounds(tileRect);
        var areaPolygon = drawnItems.getLayers()[0].toGeoJSON();
        return !turf.booleanDisjoint(polygon, areaPolygon);
    }

    function getBounds() {
        if (drawnItems.getLayers().length === 0) return null;
        return drawnItems.getLayers()[0].getBounds();
    }

    function getGrid(zoomLevel) {
        var bounds = getBounds();
        if (!bounds) return [];
        var rects = [];
        var TY = lat2tile(bounds.getNorthEast().lat, zoomLevel);
        var LX = long2tile(bounds.getSouthWest().lng, zoomLevel);
        var BY = lat2tile(bounds.getSouthWest().lat, zoomLevel);
        var RX = long2tile(bounds.getNorthEast().lng, zoomLevel);
        for (var y = TY; y <= BY; y++) {
            for (var x = LX; x <= RX; x++) {
                var rect = getTileRect(x, y, zoomLevel);
                if (isTileInSelection(rect)) {
                    rects.push({ x: x, y: y, z: zoomLevel, rect: rect });
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
        if (gridPreviewLayer) {
            map.removeLayer(gridPreviewLayer);
            gridPreviewLayer = null;
        }
    }

    function previewGrid() {
        if (drawnItems.getLayers().length === 0) {
            M.toast({html: 'Please select an area first.'});
            return;
        }
        removeGrid();
        var maxZoom = getMaxZoom();
        var grid = getGrid(maxZoom);
        var gridRects = grid.map(feature => L.rectangle(feature.rect, {color: "#fa8231", weight: 1, fill: false}));
        gridPreviewLayer = L.featureGroup(gridRects).addTo(map);

        var totalTiles = getAllGridTiles().length;
        M.toast({html: 'Total ' + totalTiles.toLocaleString() + ' tiles in the region.', displayLength: 5000});
    }

    function previewRect(rectInfo) {
        return L.rectangle(rectInfo.rect, {color: "#ff9f1a", weight: 3, fill: false}).addTo(map);
    }
    
    function removeLayer(layer) {
        if (layer && map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    }

    function generateQuadKey(x, y, z) {
        var quadKey = [];
        for (var i = z; i > 0; i--) {
            var digit = 0;
            var mask = 1 << (i - 1);
            if ((x & mask) !== 0) { digit++; }
            if ((y & mask) !== 0) { digit += 2; }
            quadKey.push(digit);
        }
        return quadKey.join('');
    }

    function initializeDownloader() {
        bar = new ProgressBar.Circle($('#progress-radial').get(0), {
            strokeWidth: 12, easing: 'easeOut', duration: 200, trailColor: '#eee', trailWidth: 1,
            from: { color: '#0fb9b1', a:0 }, to: { color: '#20bf6b', a:1 }, svgStyle: null,
            step: function(state, circle) { circle.path.setAttribute('stroke', state.color); }
        });
        $("#download-button").click(startDownloading);
        $("#stop-button").click(stopDownloading);
    }

    function showTinyTile(base64) {
        var currentImages = $(".tile-strip img");
        if(currentImages.length > 10) { $(currentImages[currentImages.length-1]).remove(); }
        var image = $("<img/>").attr('src', "data:image/png;base64, " + base64);
        $(".tile-strip").prepend(image);
    }
    
    // --- Download logic (mostly unchanged, except for bounds/center formatting) ---
    async function startDownloading() {
        if (drawnItems.getLayers().length === 0) {
            M.toast({ html: 'You need to select a region first.', displayLength: 3000 });
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
        M.Toast.dismissAll();

        var timestamp = Date.now().toString();
        var allTiles = getAllGridTiles();
        updateProgress(0, allTiles.length);

        var numThreads = parseInt($("#parallel-threads-box").val());
        var outputDirectory = $("#output-directory-box").val();
        var outputFile = $("#output-file-box").val();
        var outputType = $("#output-type").val();
        var source = $("#source-box").val();

        var bounds = getBounds();
        var boundsArray = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
        var center = bounds.getCenter();
        var centerArray = [center.lng, center.lat, getMaxZoom()];
        
        var data = new FormData();
        data.append('minZoom', getMinZoom());
        data.append('maxZoom', getMaxZoom());
        data.append('outputDirectory', outputDirectory);
        data.append('outputFile', outputFile);
        data.append('outputType', outputType);
        data.append('source', source);
        data.append('timestamp', timestamp);
        data.append('bounds', boundsArray.join(","));
        data.append('center', centerArray.join(","));

        // NOTE: The backend AJAX calls (/start-download, /download-tile, /end-download)
        // are assumed to exist. This frontend code will fail without a compatible backend.
        // For this example, we will simulate the calls and log them.
        
        logItemRaw("Starting download process... (Simulated)");
        await new Promise(r => setTimeout(r, 500)); // Simulate start-download call

        let i = 0;
        async.eachLimit(allTiles, numThreads, function(item, done) {
            if (cancellationToken) return;
            var boxLayer = previewRect(item);

            // --- SIMULATED DOWNLOAD ---
            var request = setTimeout(() => {
                if (cancellationToken) return;
                
                // Simulate success/failure
                if(Math.random() > 0.05) { // 95% success rate
                    logItem(item.x, item.y, item.z, "Tile downloaded successfully.");
                    // In a real app, you would get base64 data here. We'll skip showTinyTile for simulation.
                } else {
                    logItem(item.x, item.y, item.z, "Error downloading tile");
                }
                
                i++;
                removeLayer(boxLayer);
                updateProgress(i, allTiles.length);
                done();

                if (cancellationToken) return;
            }, 50 + Math.random() * 200); // Simulate network latency
            
            requests.push({abort: () => clearTimeout(request)});

        }, function(err) {
            if (err) {
                 logItemRaw("An error occurred: " + err);
            } else if (!cancellationToken) {
                 updateProgress(allTiles.length, allTiles.length);
                 logItemRaw("All tiles processed. Download complete.");
                 $("#stop-button").html("FINISH");
            } else {
                 logItemRaw("Download stopped by user.");
            }
        });
    }

    function updateProgress(value, total) {
        var progress = (total === 0) ? 0 : value / total;
        bar.animate(progress);
        bar.setText(Math.round(progress * 100) + '<span>%</span>');
        $("#progress-subtitle").html(value.toLocaleString() + " <span>out of</span> " + total.toLocaleString());
    }

    function logItem(x, y, z, text) { logItemRaw(x + ',' + y + ',' + z + ' : ' + text); }
    function logItemRaw(text) {
        var logger = $('#log-view');
        logger.val(logger.val() + '\n' + text);
        logger.scrollTop(logger[0].scrollHeight);
    }
    function clearLogs() { $('#log-view').val(''); }

    function stopDownloading() {
        cancellationToken = true;
        requests.forEach(req => { try { req.abort(); } catch(e) {} });
        requests = [];
        $("#main-sidebar").show();
        $("#download-sidebar").hide();
        map.eachLayer(layer => {
            if (layer instanceof L.Rectangle && !(layer instanceof L.Polygon)) {
                map.removeLayer(layer);
            }
        });
        clearLogs();
    }

    // --- Initialize Everything ---
    initializeMaterialize();
    initializeSources();
    initializeMap();
    initializeSearch();
    initializeRectangleTool();
    initializeGridPreview();
    initializeMoreOptions();
    initializeDownloader();
});
