const csvFile = 'data/data.csv';

const colors = ["#b30000", "#7c1158", "#4421af", "#1a53ff", "#0d88e6", "#00b7c7", "#5ad45a", "#8be04e", "#ebdc78"];

var places = Array();  // keep all place objects here

var layersStore = new Map();  // map of layers for each region (gebiet)

var regions = Array();  // keep all regions' names here, used for color


// Base custom legend control
L.Control.BaseControl = L.Control.extend({

	initialize: function(options) {

		L.setOptions(this, options);

		this.container = L.DomUtil.create("div", "control-legend");
		this.icon = L.DomUtil.create("div", "button");
		this.text = L.DomUtil.create("div", "text");

		this.icon.style.backgroundImage = `url(img/icon_${options.type}.png)`;

		L.DomEvent.disableScrollPropagation(this.container);
		L.DomEvent.disableClickPropagation(this.container);

		L.DomEvent.on(
			this.container,
			"mouseenter",
			(event) => {
				this.text.style.setProperty("max-height", `${ map.getSize().y - this.container.parentNode.getBoundingClientRect().height }px`);
				this.text.style.setProperty("max-width", `${ 2 * map.getSize().x / 3 }px`);
				this.icon.style.display = "none";
				this.text.style.display = "block"; },
			this);

		L.DomEvent.on(
			this.container,
			"mouseleave",
			(event) => {
				this.icon.style.display = "block";
				this.text.style.display = "none"; },
			this);

		L.DomEvent.on(
			this.container,
			"click",
			(event) => {
				if (this.text.style.display !== "block") {
					L.DomEvent.stopPropagation(this.container);
					this.icon.style.display = "block";
					this.text.style.display = "none";
				}},
			this);

		this.container.appendChild(this.icon);
		this.container.appendChild(this.text);
	},

	onAdd: function(map) {

		switch (this.options.type) {
			case "options":

				let regionsCheckbox = L.DomUtil.create("input", "", this.text);
				regionsCheckbox.setAttribute("type", "checkbox");
				regionsCheckbox.id = "regionsCheckbox";
				regionsCheckbox.checked = true;

				let regionsLabel = L.DomUtil.create("label", "", this.text);
				regionsLabel.setAttribute("for", regionsCheckbox.id);
				regionsLabel.innerText = "Color by region";

				L.DomEvent.on(
					regionsCheckbox,
					"change",
					(event) => {
						if (regionsCheckbox.checked) {
							layersStore.forEach((layer, name) => {
								layer.setStyle({
									color: colors[regions.indexOf(name) % colors.length],
									fillColor: colors[regions.indexOf(name) % colors.length],
								});
							});

						}
						else {
							layersStore.forEach((layer, name) => {
								layer.setStyle({
									color: "red",
									fillColor: "red"
								});
							});
						}
					},
					this);

				L.DomUtil.create("br", "br-class", this.text);

				let renamedCheckbox = L.DomUtil.create("input", "", this.text);
				renamedCheckbox.setAttribute("type", "checkbox");
				renamedCheckbox.id = "renamedCheckbox";
				renamedCheckbox.checked = true;

				let renamedLabel = L.DomUtil.create("label", "", this.text);
				renamedLabel.setAttribute("for", renamedCheckbox.id);
				renamedLabel.innerText = "Dim renamed";

				L.DomEvent.on(
					renamedCheckbox,
					"change",
					(event) => {
						if (renamedCheckbox.checked) {
							places.forEach((place) => {
								if (place.nameOld !== place.nameNew) {
									place.path.setStyle({
										weight: 0.5,
										fillOpacity: 0.2});
								}
							});
						}
						else {
							layersStore.forEach((layer, name) => {
								layer.setStyle({
									weight: 2,
									fillOpacity: 0.4
								});
							});
						}
					},
					this);
				break;

			case "key":
				this.text.innerHTML = `
					<ul>
						<li><span class="item-bullet">▲</span><span class="item-text">Landform</span></li>
						<li><span class="item-bullet">▬</span><span class="item-text">Waterbody</span></li>
						<li><span class="item-bullet">●</span><span class="item-text">Settlement</span></li>
						<li><span class="item-bullet">▮</span><span class="item-text">Building</span></li>
						<li><span class="item-bullet">■</span><span class="item-text">Other</span></li>
					</ul>`;
				break;

			case "list":
				abbreviations.forEach((val, key) => {
					this.text.innerHTML += `<span class="key">${key}</span> - ${val}<br/>`;
				});
				break;
		}

		return this.container;
	}
});


// Manual parsing
function parseCsv(data) {
	data = data.trim().split('\n');
	result = Array();
	for (let i=1; i < data.length; i++) {
		line = data[i].split(',');
		if (line.length >= 6) {
			let count = Math.floor((line.length - 1) / 5);
			for (let j=0; j < count; j++) {
				result.push(new Place(line[1], line[2], line[3], line[4], line[5]));
			}
		}
	}
	return result;
}


// convert parsed data from arrays to objects
// some rows can contain several items, seperate objects are created for each
function processData(data) {

	headers = data[0];

	for (let j = 1; j < data.length; j++) {
		let row = data[j];
		let count = Math.floor((row.length - 12) / 5);
		for (let i = 0; i < count; i++) {
			let item = row.slice(12 + i * 5, 17 + i * 5);
			let place = item.reduce((acc, cur, j) => {
				acc[headers[j + 12]] = cur.trim();
				return acc;
			}, {});
			place[headers[0]] = row[0] + (i ? '-' + i : '');
			place.type = data[j][8];
			place.gebiet = data[j][2] + ((data[j][3]) ? ` > ${data[j][3]}` : '');
			place.details = data[j][11];
			place.lat = parseFloat(place.lat);
			place.lon = parseFloat(place.lon);
			places.push(place);
		}
	}

	drawData();
}


function drawData() {

	const r = 1000;
	const dlat = r / 111320;

	//for (let place of places) {
	for (let i = 0; i < places.length; i++) {

		let place = places[i];

		if (!regions.includes(place.gebiet)) {
			regions.push(place.gebiet);
		}

		let renamed = (place.nameNew !== place.nameOld);

		let settings = {
			stroke: true,
			color: colors[regions.indexOf(place.gebiet) % colors.length],
			weight: renamed ? 0.5 : 2,
			opacity: 0.9,
			fillColor: colors[regions.indexOf(place.gebiet) % colors.length],
			fillOpacity: renamed ? 0.2 : 0.4
		};

		const dlon = r / (111320 * Math.cos(place.lat * Math.PI / 180));

		points = Array();
		let vector = {};

		// ▲ mountains, hills etc.
		if (place.type.match(/b[ei]rg|gipf|Hügel/i)) {
			points = [
				[place.lat + dlat, place.lon],
				[place.lat - dlat * (Math.sin(Math.PI / 6)), [place.lon + dlon * Math.cos(Math.PI / 6)]],
				[place.lat - dlat * (Math.sin(Math.PI / 6)), [place.lon - dlon * Math.cos(Math.PI / 6)]]
			];
			vector = L.polygon(points, settings);
		}
		// ▬ water
		else if (place.type.match(/fl|see|bucht/i)) {
			points = [
				[place.lat + dlat / 2, place.lon - dlon],
				[place.lat - dlat / 2, place.lon + dlon]
			];
			vector = L.rectangle(points, settings);
		}
		// ● villages, towns etc.
		else if (place.type.match(/(ON|ort|stadt|viertel|χωρ)/i)) {
			points = [place.lat, place.lon];
			settings.radius = r;
			vector = L.circle(points, settings);
		}
		// ▮ castles, monastaries etc.
		else if (place.type.match(/kastel|Fest|Μον|Kloster/i)) {
			points = [
				[place.lat + dlat, place.lon - dlon / 2],
				[place.lat - dlat, place.lon + dlon / 2]
			];
			vector = L.rectangle(points, settings);
		}
		// ■ regions, areas, valleys and everything else
		else {
			points = [
				[place.lat + dlat, place.lon - dlon],
				[place.lat - dlat, place.lon + dlon]
			];
			vector = L.rectangle(points, settings);
		}

		place.path = vector.addTo(map);

		// underline the referrences

		let richDetails = place.details;
		let matches = [];
		abbreviations.forEach((val, key) => {
			// FIXME: some abbreviations lack punctuation
			let regex = new RegExp(key.replaceAll("\.", "\\.").replaceAll("\-", "\\-"), "g");
			for (let match of place.details.matchAll(regex)) {
				matches.push(match);
			}
		});

		// sort matches 
		matches.sort((a, b) => { return a.index - b.index; });
		// remove substrings
		cleanMatches = [];
		for (let i = 1; i < matches.length; i++) {
			if (matches[i].index !== matches[i-1].index) {
				cleanMatches.push(matches[i-1]);
			}
		}
		if (matches.length > 0) {
			cleanMatches.push(matches.pop());
		}
		// inject span nodes
		let offset = 0;
		for (let match of cleanMatches) {
			let injection = `<span class="ref" title="${abbreviations.get(match[0])}">${match[0]}</span>`;
			richDetails = richDetails.slice(0, offset + match.index) + injection + richDetails.slice(offset + match.index + match[0].length);
			offset += (injection.length - match[0].length);
		}

		// tooltips and popups
		vector.bindTooltip(place.nameOld);
		vector.bindPopup(`
			${place.id}<br/>
			${place.gebiet}
			<h1>${place.nameOld}</h1>
			${ !renamed ? '' : '<h2>( ' + place.nameNew + ' )</h2>'}
			<h3>${place.type}</h3>
			${richDetails}
			<div class="navigation">
			<a href="#" title="Previous" onclick="jumpToPopup(${i - 1})"><<<</a> 
			<a href="#" title="Next" onclick="jumpToPopup(${i + 1})">>>></a> 
			</div>
		`);

		if (!layersStore.has(place.gebiet)) {
			let newGroup = new L.FeatureGroup();
			newGroup.addTo(map);
			layerControl.addOverlay(newGroup, place.gebiet, "All regions");
			layersStore.set(place.gebiet, newGroup);
		}
		layersStore.get(place.gebiet).addLayer(vector);
	}
}


function jumpToPopup(index) {
	places[index < 0 ? places.length - 1 : index % places.length].path.openPopup();
}


// THE MAP

var map = L.map('map').setView([38.5, 23.5], 7);


// BASE LAYERS

var osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 17,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
	referrerPolicy: 'strict-origin-when-cross-origin'
});

var cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
	maxZoom: 17,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution">CARTO</a>',
	referrerPolicy: 'strict-origin-when-cross-origin'
}).addTo(map);


// SCALE

var scaleControl = L.control.scale({maxWidth: 300, imperial: false}).addTo(map);


// LAYER CONTROL

var layerControl = L.control.groupedLayers().addTo(map);
layerControl.options.groupCheckboxes = true;
L.DomEvent.disableScrollPropagation(layerControl.getContainer());
L.DomEvent.disableClickPropagation(layerControl.getContainer());

layerControl.addBaseLayer(osmLayer, "OSM");
layerControl.addBaseLayer(cartoLayer, "CARTO");


// CUSTOM CONTROLS

var optionsControl = new L.Control.BaseControl({position: "topright", type: "options"});

optionsControl.addTo(map);


var legendControl = new L.Control.BaseControl({position: "topright", type: "key"});

legendControl.addTo(map);


var abbrevControl = new L.Control.BaseControl({position: "topright", type: "list"});

abbrevControl.addTo(map);


Papa.parse(csvFile, {
	download: true,
	header: false,
	complete: (results) => { processData(results.data); },
	error: (error) => console.error(`Error loading ${csvFile}:`, error)
});
