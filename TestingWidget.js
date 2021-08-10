/**
 * SignInApp v2 - v2 of the freeboard plugin for accessing and displaying data found within the Sign In App clientAPI.
 * Copyright (c) 2021 Sign In App Ltd | https://signinapp.com/
 * Created: 26/04/21
 * @author Luke Bonsey  (lbonsey@signinapp.co.uk)
 * @version 2.0
 */

(function () {

    // CONSTANTS
    const REFRESH_TIME_MILLIS = 60000;
    const UK_BASE_URL = "https://backend.signinapp.com";
    const EU_BASE_URL = "https://backend.eu-n1.signinapp.com";
    const US_BASE_URL = "https://backend.us-e1.signinapp.com";
    const AU_BASE_URL = "https://backend.ap-se2.signinapp.com";
    const CLIENT_API_PATH = "/client-api/v1";
    const DASHBOARD_ENDPOINT = "/dashboard";
    const IS_INTEGER = RegExp(/^[0-9]*$/);

    // sia datasource configuration
    freeboard.loadDatasourcePlugin({
        "type_name": "sign_in_app_datasource",
        "display_name": "Sign In App",
        "description": "Sign In App datasource for accessing data found within the Sign In App client API",
        "settings": [
            {
                "name": "site_ids",
                "display_name": "Site IDs",
                "type": "text",
                "description": "IDs of the sites you wish to monitor, separated by commas eg: 1,2,3"
            },
            {
                "name": "group_ids",
                "display_name": "Group IDs",
                "type": "text",
                "description": "IDs of the groups you wish to monitor, separated by commas eg: 1,2,3"
            },
            {
                "name": "client_key",
                "display_name": "Client Key",
                "type": "text"
            },
            {
                "name": "secret_key",
                "display_name": "Secret Key",
                "type": "text"
            },
            {
                "name": "region_url",
                "display_name": "Region",
                "type": "option",
                "options": [
                    {
                        "name": "UK (London)",
                        "value": UK_BASE_URL+CLIENT_API_PATH,
                    },
                    {
                        "name": "EU (Stockholm)",
                        "value": EU_BASE_URL+CLIENT_API_PATH,
                    },
                    {
                        "name": "US (N. Virginia)",
                        "value": US_BASE_URL+CLIENT_API_PATH,
                    },
                    {
                        "name": "AU (Sydney)",
                        "value": AU_BASE_URL+CLIENT_API_PATH,
                    }
                ]
            }
        ],
        newInstance: function (settings, newInstanceCallback, updateCallback) {
            newInstanceCallback(new siaDatasource(settings, updateCallback));
        }
    });

    // sign in app datasource instance
    const siaDatasource = function (settings, updateCallback) {
        const self = this;
        let currentSettings = settings;
        let refreshTimer;

        const spinner = createSpinner();
        spinner.show = true;

        async function getData() {
            let data = {};
            try {
                const url = currentSettings.region_url+DASHBOARD_ENDPOINT;
                const body = {
                    'sites': currentSettings.site_ids.split(',').map(x=>+x),
                    'groups': currentSettings.group_ids.split(',').map(x=>+x),
                }
                const auth = `${currentSettings.client_key}:${currentSettings.secret_key}`;
                data = await callAPI(url, body, auth);
            } catch (e) {
                createError(e);
            }

            spinner.show = false;
            updateCallback(data);
        }

        function callAPI(url, body, auth) {
            return $.ajax({
                url: url,
                dataType: "JSON",
                data: body,
                beforeSend: (xhr) => xhr.setRequestHeader("Authorization", `Basic ${btoa(auth)}`)
            });
        }

        // called in regular time intervals in the background
        function createRefreshTimer(interval) {
            if (refreshTimer) clearInterval(refreshTimer);
            refreshTimer = setInterval(async () => await self.updateNow(), interval);
        }

        // called whenever any datasource settings are changed
        self.onSettingsChanged = async (newSettings) => {
            currentSettings = newSettings;
            spinner.show = true;
            self.updateNow();
        }

        // called when the refresh button is manually clicked
        self.updateNow = async () => await getData();

        // called when the datasource is deleted
        self.onDispose = () => {
            clearInterval(refreshTimer);
            refreshTimer = undefined;
        }

        createRefreshTimer(REFRESH_TIME_MILLIS);
    }

    // returns a new spinner instance
    function createSpinner() {
        return {
            shown: false,
            id: null,
            set show(val) {
                this.shown = val;

                if (val) {
                    const loader = document.createElement('div');
                    loader.classList.add('loader');

                    const loaderText = document.createElement('p');
                    loaderText.classList.add('loader-text');
                    loaderText.innerHTML = 'Fetching data from Sign In App...';

                    const loaderContent = document.createElement('div');
                    loaderContent.classList.add('loader-content');
                    loaderContent.appendChild(loader);
                    loaderContent.appendChild(loaderText);

                    const wrapper = document.createElement('div');
                    wrapper.classList.add('loader-wrapper');
                    this.id = generateId();
                    wrapper.id = this.id;
                    wrapper.appendChild(loaderContent);

                    document.body.appendChild(wrapper);
                }

                else {
                    const spinner = document.querySelector(`#${this.id}`)
                    if(spinner) spinner.remove();
                }
            }
        }
    }

    // returns a randomised id
    function generateId() {
        return Math.random().toString(36).replace('0.', 'SIA');
    }

    // returns a new error message popup instance
    function createError(err) {
        const existingMessage = document.querySelector('#error-wrapper');
        if (existingMessage) return;

        const errorText = document.createElement('p');
        errorText.classList.add('loader-text');
        errorText.innerHTML = (() => {
            switch (err.status) {
                case 401:
                    return '401 - unauthorised. Please check that your client key and secret key are correct.'
                case 422:
                    return '422 - unprocessable entity. Please check that your site ids and group ids are correct.'
                case 429:
                    return '429 - too many requests. Please close this tab and try again in a few minutes.'
                default:
                    return 'Something went wrong. Please check your datasource settings and try again.'
            }
        })();

        const errorButton = document.createElement('button');
        errorButton.classList.add('error-button');
        errorButton.onclick = () => document.querySelector('#error-wrapper').remove();
        errorButton.innerHTML = 'Close';

        const errorContent = document.createElement('div');
        errorContent.classList.add('loader-content');
        errorContent.appendChild(errorText);
        errorContent.appendChild(errorButton);

        const wrapper = document.createElement('div');
        wrapper.id = 'error-wrapper'
        wrapper.classList.add('loader-wrapper');
        wrapper.appendChild(errorContent);

        document.body.appendChild(wrapper);
    }

    // returns a widget error message instance
    function createWidgetError(widgetId) {
        const error = document.createElement('div');
        error.classList.add('sia-widget-error')
        error.id = widgetId + 'error';
        error.innerHTML = "Sorry, one of the values provided is in the wrong format. Please check the widget's settings.";
        document.querySelector(`#${widgetId}`).parentElement.append(error);
    }

    // sia big number widget configuration
    freeboard.loadWidgetPlugin({
        "type_name": "sia_big_number_widget",
        "display_name": "SIA Big Number Widget",
        "description": "A widget for neatly displaying important values (e.g: staff on site, visitors on site, etc.)",
        "fill_size": false,
        "settings": [
            {
                "name": "caption",
                "display_name": "Caption",
                "type": "text"
            },
            {
                "name": "value",
                "display_name": "Value",
                "type": "calculated"
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new bigNumberWidget(settings));
        }
    });

    // big number widget
    const bigNumberWidget = function (settings) {
        const self = this;
        const id = generateId();
        let currentSettings = settings;
        const table = $(`<table id="${id}" class="big-number-table"></table>`);

        self.getHeight = () => {return 2};
        self.render = (containerElement) => $(containerElement).append(table);
        self.onSettingsChanged = (newSettings) => currentSettings = newSettings;

        self.onCalculatedValueChanged = function (settingName, newValue) {
            $(table).empty(); // clear existing table

            // if error message exists, destroy it
            const err = document.getElementById(id + 'error');
            if (err) err.remove();

            if (IS_INTEGER.test(newValue)) {
                const textCell = `<td class="big-caption">${currentSettings.caption}</td>`;
                const numberCell = `<td class="big-value cell-fit-content">${newValue}</td>`;
                const row = $(`<tr>${textCell}${numberCell}</tr>`);
                $(table).append(row);
            } else {
                createWidgetError(id);
            }
        }
    }

    // sia occupancy widget configuration
    freeboard.loadWidgetPlugin({
        "type_name": "sia_occupancy_widget",
        "display_name": "SIA Occupancy Widget",
        "description": "A widget for displaying a site's occupancy (as a percentage).",
        "fill_size": false,
        "external_scripts": ["https://cdn.jsdelivr.net/npm/chart.js@2.9.4/dist/Chart.min.js"],
        "settings": [
            {
                "name": "title",
                "display_name": "Title",
                "type": "text"
            },
            {
                "name": "value",
                "display_name": "Value",
                "type": "calculated"
            },
            {
                "name": "max",
                "display_name": "Max",
                "type": "text"
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new occupancyWidget(settings));
        }
    });

	freeboard.loadDatasourcePlugin({
		"type_name"   : "TableWidget",
		"display_name": "Table",
		 "description" : "Some sort of description <strong>with optional html!</strong>",
		
	
	//Setting white-space to normal to override gridster's inherited value
	freeboard.addStyle('table.list-table', "width: 100%; white-space: normal !important; ");
	freeboard.addStyle('table.list-table td, table.list-table th', "padding: 2px 2px 2px 2px; vertical-align: top; ");
	
	var tableWidget = function (settings) {
	        var self = this;
	        var titleElement = $('<h2 class="section-title"></h2>');
	        var stateElement = $('<div><table class="list-table"><thead/></table></div>');
	        var currentSettings = settings;
		//store our calculated values in an object
		var stateObject = {};
        
		function updateState() {            			
			stateElement.find('thead').empty();
			stateElement.find('tbody').remove();
			var bodyHTML = $('<tbody/>');
			var classObject = {};
			var classCounter = 0;
			
		    var replaceValue = (_.isUndefined(currentSettings.replace_value) ? '' : currentSettings.replace_value);			
			
			//only proceed if we have a valid JSON object
			if (stateObject.value && stateObject.value.header && stateObject.value.data) {
				var headerRow = $('<tr/>');
				var templateRow = $('<tr/>');
				var rowHTML;
				
				//Loop through the 'header' array, building up our header row and also a template row
				try {					
					$.each(stateObject.value.header, function(headerKey, headerName){
						classObject[headerName] = 'td-' + classCounter;
						headerRow.append($('<th/>').html(headerName));						
						templateRow.append($('<td/>').addClass('td-' + classCounter).html(replaceValue));		
						classCounter++;						
					})					
				} catch (e) {
					console.log(e);
				}
				
				//Loop through each 'data' object, cloning the templateRow and using the class to set the value in the correct <td>
				try {
					$.each(stateObject.value.data, function(k, v){
						rowHTML = templateRow.clone();						
						$.each(v, function(dataKey, dataValue){									
							rowHTML.find('.' + classObject[dataKey]).html(dataValue);
						})
						bodyHTML.append(rowHTML);
					})
				} catch (e) {
					console.log(e)
				}	
				
				//Append the header and body
				stateElement.find('thead').append(headerRow);
				stateElement.find('table').append(bodyHTML);
				
				//show or hide the header based on the setting
				if (currentSettings.show_header) {					
					stateElement.find('thead').show();
				} else {
					stateElement.find('thead').hide();
				}
			}
        }

        this.render = function (element) {
            $(element).append(titleElement).append(stateElement);
        }		

        this.onSettingsChanged = function (newSettings) {
            currentSettings = newSettings;
            titleElement.html((_.isUndefined(newSettings.title) ? "" : newSettings.title));			
            updateState();			
        }

        this.onCalculatedValueChanged = function (settingName, newValue) {
            //whenver a calculated value changes, stored them in the variable 'stateObject'
			stateObject[settingName] = newValue;
            updateState();
        }

        this.onDispose = function () {
        }

        this.getHeight = function () {    
			var height = Math.ceil(stateElement.height() / 55);			
			return (height > 0 ? height : 1);
        }

        this.onSettingsChanged(settings);
    };

    freeboard.loadWidgetPlugin({
        type_name: "list",
        display_name: "Table",
        settings: [
            {
                name: "title",
                display_name: "Title",
                type: "text"
            },
			{
                name: "show_header",
                display_name: "Show Headers",
				default_value: true,
                type: "boolean"
            },
			{
                name: "replace_value",
                display_name: "Replace blank values",
                type: "text"
            },
			{
                name: "value",
                display_name: "Value",
                type: "calculated"
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new tableWidget(settings));
        }
    });
	
	

    // sia graph widget configuration
    freeboard.loadWidgetPlugin({
        "type_name": "Test Graph_Widget",
        "display_name": "Test Graph Widget",
        "description": "A widget for graphically displaying your sign in data.",
        "external_scripts": [
            "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js",
            "https://cdn.jsdelivr.net/npm/chart.js@2.9.4/dist/Chart.min.js",
            "https://rawcdn.githack.com/jedtrow/Chart.js-Rounded-Bar-Charts/c415f077390497406b8a8bb7bacc1b5d39120f53/Chart.roundedBarCharts.min.js"
        ],
        "fill_size": false,
        "settings": [
            {
                "name": "title",
                "display_name": "Title",
                "type": "text"
            },
            {
                "name": "data",
                "display_name": "Data",
                "type": "calculated",
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new graphWidget(settings));
        }
    });

    // sia graph widget
    const graphWidget = function (settings) {
        const self = this;
        const id = generateId();
        const canvas = $(`<canvas id="${id}"></canvas>`);
        let currentSettings = settings;
        let theChart = null;

        self.render = (containerElement) => {
            $(containerElement).append(canvas);
            appendTitle(currentSettings.title, id, document.getElementById(id).parentElement);
        }
        self.getHeight = () => {return (currentSettings.title) ? 7 : 6};
        self.onSettingsChanged = (newSettings) => {
            currentSettings = newSettings;
            appendTitle(currentSettings.title, id, document.getElementById(id).parentElement);
        }

        self.onCalculatedValueChanged = (settingName, newValue) => {
            if (theChart) theChart.destroy(); // if chart already exists, destroy it
            const err = document.getElementById(id + 'error');
            if (err) { // if error message exists, destroy it (and re-display widget)
                err.remove();
                document.getElementById(id).style.display = 'inline-block';
            }

            if (sourceIsValid(newValue)) {
                const chartLabels = Object.keys(newValue).map((key, index) => {
                    if (index === 26) return 'Yesterday'
                    else if (index === 27) return 'Today'
                    return moment(key).format('ddd (D/M)')
                });

                const ctx = document.getElementById(id).getContext('2d');
                theChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: chartLabels,
                        datasets: [{
                            label: 'On Site',
                            data: Object.keys(newValue).map((x) => {return newValue[x]}),
                            backgroundColor: Array(Object.keys(newValue).length).fill('rgba(39, 232, 111, 1)'),
                            borderColor: Array(Object.keys(newValue).length).fill('rgba(39, 232, 111, 1)'),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        legend: {
                            display: false,
                        },
                        cornerRadius: 100, // Credit to https://github.com/jedtrow/
                        scales: {
                            yAxes: [{
                                ticks: {
                                    beginAtZero: true,
                                    maxTicksLimit: 10,
                                    fontColor: 'lightgrey',
                                    fontSize: 14,
                                    fontFamily: "'Titillium Web', sans-serif"
                                }
                            }],
                            xAxes: [{
                                ticks: {
                                    autoSkip: true,
                                    maxTicksLimit: 14,
                                    fontColor: 'lightgrey',
                                    fontFamily: "'Titillium Web', sans-serif"
                                }
                            }]
                        },
                        animation: {
                            duration: 0
                        }
                    }
                })
            } else {
                createWidgetError(id);
                document.getElementById(id).style.display = 'none';
            }

        }

        function sourceIsValid(historyData) {
            const validLength = Object.keys(historyData).length === 28;
            let validValues = true;
            try {
                Object.values(historyData).forEach(val => {
                    if (!validValues) return;
                    validValues = validValues && Number.isInteger(val);
                });
            } catch (e) {
                validValues = false
            }
            return validLength && validValues;
        }
    }

    // -------
    // STYLING
    // -------

    // spinner styling
    freeboard.addStyle('.loader', 'border: 7px solid rgba(0,0,0,0);' +
        'border-radius: 50%;' +
        'border-top: 7px solid #27e86f; ' +
        'border-left: 7px solid #27e86f; ' +
        'width: 60px;' +
        'height: 60px;' +
        'animation: spin 0.6s linear infinite; ' +
        'display: block; ' +
        'margin: 0 auto;'
    );

    // animation keyframes
    const keyFrames = '\
		@keyframes spin {\
			0% { transform: rotate(0deg); }\
			100% { transform: rotate(360deg); }\
		}';
    const style = document.createElement('style');
    style.innerHTML = keyFrames;
    document.head.appendChild(style);

    // loader text styling
    freeboard.addStyle('.loader-text', 'color: white; ' +
        'font-family: "Titillium Web", sans-serif; ' +
        'font-size: 16px;'
    );

    // loader content styling
    freeboard.addStyle('.loader-content', 'position: absolute; ' +
        'top: 50%; ' +
        'left: 50%; ' +
        'transform: translate(-50%, -50%);' +
        'text-align: center;'
    );

    // loading spinner wrapper styling
    freeboard.addStyle('.loader-wrapper', 'width: 100%; ' +
        'height: 100%; ' +
        'position: absolute; ' +
        'background-color: rgba(0,0,0,0.85); ' +
        'z-index: 99; ' +
        'top: 0;'
    );

    // error button styling
    freeboard.addStyle('.error-button', 'color: white; ' +
        'font-family: "Titillium Web", sans-serif; ' +
        'font-size: 18px;' +
        'border-radius: 10px;' +
        'background-color: rgba(0,0,0,0);' +
        'border: 1px solid white;'
    );

    // sia widget error message styling
    freeboard.addStyle('.sia-widget-error', 'color: rgb(255,79,71); ' +
        'font-size:18px; ' +
        'white-space:pre-wrap; ' +
        'font-family: "Titillium Web", sans-serif; ' +
        'padding: 15px 30px;'
    );

    // general widget title styling
    freeboard.addStyle('.sia-widget-title', 'font-family: "Titillium Web", sans-serif;' +
        'font-weight:600;' +
        'font-size: 16px;' +
        'color: #efefef;' +
        'margin:5px;' +
        'padding-left: 3px;'
    );

    // big number table styling
    freeboard.addStyle('.big-number-table', 'width:100%; ' +
        'border-collapse:separate; ' +
        'border-spacing:5px 10px; ' +
        'color: lightgrey; ' +
        'font-family: "Titillium Web", sans-serif;'
    );

    // big number caption styling
    freeboard.addStyle('.big-caption', 'font-size:24px; ' +
        'max-width: 200px; ' +
        'white-space: initial;'
    );

    // big number value styling
    freeboard.addStyle('.big-value', 'font-size:64px; ' +
        'color: #27e86f; ' +
        'min-width: 50px;'
    );

    // occupancy inner styling
    freeboard.addStyle('.donut-inner', 'margin-top: -105px;' +
        'text-align: center;' +
        'font-family: "Titillium Web", sans-serif;' +
        'color: white;' +
        'font-size: 28px;'
    );

    // activity table styling
    freeboard.addStyle('.activity-table', 'width:100%; ' +
        'border-collapse:separate; ' +
        'border-spacing:5px 15px; ' +
        'line-height:20px; ' +
        'font-size:15px; ' +
        'color: lightgrey; ' +
        'font-family: "Titillium Web", sans-serif;'
    );

    // activity image styling
    freeboard.addStyle('.activity-img', 'border-radius:50%; ' +
        'vertical-align:middle; ' +
        'margin-right:10px;'
    );

    // general cell fit content styling
    freeboard.addStyle('.cell-fit-content', 'width:1%; white-space:nowrap;')

    // activity time cell styling
    freeboard.addStyle('.time-cell', 'text-align:right; ' +
        'margin-left:10px'
    );

    // members table styling
    freeboard.addStyle('.members-table', 'width:100%; ' +
        'border-collapse:separate; ' +
        'border-spacing:5px 15px; ' +
        'line-height:20px; ' +
        'font-size:16px; ' +
        'color: lightgrey; ' +
        'font-family: "Titillium Web", sans-serif;'
    );

    // members image styling
    freeboard.addStyle('.members-img', 'border-radius:50%; ' +
        'vertical-align:middle;'
    );

    // members online dot styling
    freeboard.addStyle('.online-dot', 'height:13px; ' +
        'width:13px; ' +
        'background-color: #27e86f; ' +
        'border-radius: 50%; ' +
        'display: inline-block; ' +
        'margin-left: -5px; ' +
        'margin-right: 5px;'
    );

}());