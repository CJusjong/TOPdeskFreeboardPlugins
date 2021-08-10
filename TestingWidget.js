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

    // occupancy widget
    const occupancyWidget = function (settings) {
        const self = this;
        const id = generateId();
        let currentSettings = settings;
        const canvas = $(`<canvas id="${id}" style="margin-top: 15px; margin-bottom: 15px"></canvas>`);
        let theChart = null;

        self.getHeight = () => {return (currentSettings.title && currentSettings.title.trim()) ? 4 : 3};
        self.render = (containerElement) => {
            $(containerElement).append(canvas);
            appendTitle(currentSettings.title, id, document.getElementById(id).parentElement, '30px');
        }
        self.onSettingsChanged = (newSettings) => {
            currentSettings = newSettings;
            appendTitle(currentSettings.title, id, document.getElementById(id).parentElement, '30px');
        }

        self.onCalculatedValueChanged = function (settingName, newValue) {
            if (theChart) theChart.destroy(); // if chart already exists destroy it

            // if inner number exists destroy it
            const inner = document.getElementById(id + 'inner');
            if (inner) inner.remove();

            // if error message exists, destroy it (and redisplay canvas)
            const err = document.getElementById(id + 'error');
            if (err) {
                err.remove();
                document.getElementById(id).style.display = 'inline-block';
            }

            if (IS_INTEGER.test(newValue) && IS_INTEGER.test(currentSettings.max)) {
                let percentage = newValue/currentSettings.max * 100;
                if (!Number.isInteger(percentage)) percentage = percentage.toFixed(1);
                const donutColour = (percentage <= 100) ? 'rgb(39, 232, 111)' : 'rgb(222, 64, 64)'
                const chartData = (percentage <= 100) ? [percentage, 100 - percentage] : [percentage];
                const ctx = document.getElementById(id).getContext('2d');
                theChart = new Chart(ctx, {
                    type: (percentage > 0) ? 'Occupancy' : 'doughnut',
                    data: {
                        labels: ['Occupied (%)', 'Free (%)'],
                        datasets: [{
                            data: chartData,
                            backgroundColor: [donutColour, 'rgba(211, 211, 211, 0.2)'],
                            borderColor: 'rgba(0,0,0,0)',
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        legend: {display: false},
                        cutoutPercentage: 75,
                        animation: {duration: 0}
                    }
                });

                const inner = document.createElement('div');
                inner.classList.add('donut-inner');
                inner.id = id + 'inner';
                inner.innerHTML = percentage + "%";
                document.getElementById(id).parentElement.append(inner);
            } else {
                document.getElementById(id).style.display = 'none';
                createWidgetError(id);
            }
        }

        // create rounded version of doughnut chart
        Chart.defaults.Occupancy = Chart.helpers.clone(Chart.defaults.doughnut);
        Chart.controllers.Occupancy = Chart.controllers.doughnut.extend({
            draw: function () {
                var ctx = this.chart.chart.ctx;
                Chart.helpers.each(this.getMeta().data, function (arc) {
                    arc.transition(1).draw();
                    const vm = arc._view;
                    const radius = (vm.outerRadius + vm.innerRadius) / 2;
                    const thickness = (vm.outerRadius - vm.innerRadius) / 2;
                    const angle = Math.PI - vm.endAngle - Math.PI / 2;
                    ctx.save();
                    ctx.fillStyle = vm.backgroundColor;
                    ctx.translate(vm.x, vm.y);
                    ctx.beginPath();
                    ctx.arc(radius * Math.sin(angle), radius * Math.cos(angle), thickness, 0, 2 * Math.PI);
                    ctx.arc(radius * Math.sin(Math.PI), radius * Math.cos(Math.PI), thickness, 0, 2 * Math.PI);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                });
            },
        });
    }

    // sia recent activity widget configuration
    freeboard.loadWidgetPlugin({
       "type_name": "sia_activity_widget",
       "display_name": "SIA Activity Widget",
       "description": "A widget for neatly displaying recent activity on your site",
        "fill_size": false,
        "external_scripts": ["https://momentjs.com/downloads/moment.js"],
        "settings": [
            {
                "name": "title",
                "display_name": "Title",
                "type": "text"
            },
            {
                "name": "activity_source",
                "display_name": "Activity Source",
                "type": "calculated"
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
           newInstanceCallback(new recentActivityWidget(settings));
        }
    });

    function appendTitle(text, widgetId, parentElement, marginBotton = null) {
        const existingTitle = document.getElementById(widgetId + '-title');
        if (existingTitle) existingTitle.remove();

        if (text && text.trim()) {
            const title = document.createElement('p');
            title.id = widgetId + '-title';
            title.classList.add('sia-widget-title');
            if (marginBotton) title.style.marginBottom = marginBotton;
            title.innerHTML = trimName(text.toUpperCase(), 30);
            parentElement.insertBefore(title, parentElement.firstElementChild);
            // document.getElementById(widgetId).parentElement.insertBefore(title, document.getElementById(widgetId));
        }
    }

    // recent activity widget
    const recentActivityWidget = function (settings) {
        const self = this;
        let currentSettings = settings;
        const id = generateId();
        const activity = $(`<table id="${id}" class="activity-table"></table>`);

        self.getHeight = () => {return (currentSettings.title && currentSettings.title.trim()) ? 6 : 5};
        self.render = (containerElement) => {
            $(containerElement).append(activity);
            appendTitle(currentSettings.title, id, document.getElementById(id).parentElement);
        }
        self.onSettingsChanged = (newSettings) => {
            currentSettings = newSettings;
            appendTitle(currentSettings.title, id, document.getElementById(id).parentElement);
        }

        self.onCalculatedValueChanged = (settingName, newValue) => {
            $(activity).empty(); // clear existing activity html
            const err = document.getElementById(id + 'error');
            if (err) err.remove(); // if error message exists, destroy it

            const recentActivity = Object.values(newValue);
            if (sourceIsValid(recentActivity)) {

                if (recentActivity.length == 0) {
                    const noActivity = '<td style="text-align: center; padding-top: 20px;">No activity to show</td>'
                    const row = $(`<tr>${noActivity}</tr>`);
                    $(activity).append(row);
                    return;
                }

                const maxLength = 30 - getLongestTimeString(newValue).length;
                recentActivity.forEach((event) => {
                    event.status = (event.rejected_sign_in) ? 'rejected sign in' : event.status.replace('_', ' ');
                    const imageSrc = event.photo_url ? event.photo_url : 'https://www.gravatar.com/avatar/?d=mp';
                    const image = `<img class="activity-img" width="30" height="30" src="${imageSrc}" />`
                    const imageCell = `<td class="cell-fit-content">${image}</td>`;
                    const textCell = `<td style="white-space: pre;">${trimName(event.name, maxLength)}\n${event.status}</td>`
                    const prettyTime = moment(event.timestamp).fromNow();
                    const timeCell = `<td class="time-cell cell-fit-content">${prettyTime}</td>`;
                    const rowColour = (event.rejected_sign_in) ? '#ff5e5e' : '';
                    const row = $(`<tr style="color: ${rowColour}">${imageCell + textCell + timeCell}</tr>`);
                    $(activity).append(row);
                });
            } else {
                createWidgetError(id);
            }
        }

        function sourceIsValid(recentActivity) {
            const validLength = recentActivity.length <= 5;
            let validKeys = true;
            recentActivity.forEach((event) => {
                if (!validKeys) return;
                validKeys = validKeys && (Object.keys(event).length == 5);
                validKeys = validKeys && event.hasOwnProperty('name')
                    && event.hasOwnProperty('rejected_sign_in')
                    && event.hasOwnProperty('photo_url')
                    && event.hasOwnProperty('status')
                    && event.hasOwnProperty('timestamp');
            });
            return validLength && validKeys;
        }

        function getLongestTimeString(recentActivity) {
            let currentLongest = '';
            for (const index in recentActivity) {
                const prettyTime = moment(recentActivity[0].timestamp).fromNow();
                if (prettyTime.length > currentLongest.length) currentLongest = prettyTime;
            }
            return currentLongest;
        }
    }

    function trimName(name, maxLength) {
        if (name.length > maxLength) {return (name.substring(0, maxLength - 3) + '...')}
        else return name;
    }

    // sia members status widget configuration
    freeboard.loadWidgetPlugin({
        "type_name": "sia_members_status_widget",
        "display_name": "SIA Members Status Widget",
        "description": "A widget for neatly displaying the status of group members",
        "external_scripts": [
            "https://rawcdn.githack.com/marcj/css-element-queries/4eae4654f4683923153d8dd8f5c0d1bc2067b2a8/src/ResizeSensor.js",
            "https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"
        ],
        "fill_size": false,
        "settings": [
            {
                "name": "title",
                "display_name": "Title",
                "type": "text"
            },
            {
                "name": "group",
                "display_name": "Group",
                "type": "calculated",
            },
            {
                "name": "height",
                "display_name": "Height",
                "type": "text",
                "description": "Height of the widget (in blocks, not pixels!)"
            },
            {
                "name": "siteID",
                "display_name": "Site ID",
                "type": "text",
                "description": "Scope this widget to a specific site"
            },
            {
                "name": "showSiteNames",
                "display_name": "Show Site Names",
                "type": "option",
                "options": [
                    {
                        "name": "YES",
                        "value": "true",
                    },
                    {
                        "name": "NO",
                        "value": "false",
                    }
                ]
            },
            {
                "name": "showSignedOut",
                "display_name": "Show Signed Out",
                "type": "option",
                "options": [
                    {
                        "name": "YES",
                        "value": "true",
                    },
                    {
                        "name": "NO",
                        "value": "false",
                    }
                ]
            }
        ],
        newInstance: function (settings, newInstanceCallback) {
            newInstanceCallback(new membersStatusWidget(settings));
        }
    });

    // sia members status widget
    const membersStatusWidget = function (settings) {
        const self = this;
        const id = generateId();
        const membersTable = $(`<table id="${id}" class="members-table"></table>`)
        const tableWrapper = $(`<div style="overflow-y: auto"></div>`)
        let currentSettings = settings;
        let maxColumns = 1;
        let resizeSensor = null;

        self.render = (containerElement) => {
            $(tableWrapper).append(membersTable);
            $(containerElement).append(tableWrapper);
            appendTitle(currentSettings.title, id, document.getElementById(id).parentElement.parentElement, '15px');
        }
        self.getHeight = () => {return !currentSettings.height ? 5 : currentSettings.height};
        self.onSettingsChanged = (newSettings) => {
            currentSettings = newSettings;
            appendTitle(currentSettings.title, id, document.getElementById(id).parentElement.parentElement, '15px');
        }

        self.onCalculatedValueChanged = (settingName, newValue) => {
            if (resizeSensor) resizeSensor.detach();
            resizeSensor = new ResizeSensor(document.getElementById(id).parentElement, () => resizeTable(newValue));

            drawMembersTable(newValue);

            // Autoscroll behaviour
            if( !$(tableWrapper).is(':animated') ) scrollToBottom();

            document.getElementById(id).onmouseover = () => $(tableWrapper).stop();
            document.getElementById(id).onmouseleave = () => scrollToBottom();
        }

        function drawMembersTable(newValue) {
            $(membersTable).empty();

            const err = document.getElementById(id + 'error');
            if (err) err.remove(); // if error message exists, destroy it

            if (sourceIsValid(newValue)) {
                let copiedData = _.cloneDeep(newValue); // make deep copy of data

                // make sure siteID has valid format
                if (currentSettings.siteID) {
                    if (!Number.isInteger(parseInt(currentSettings.siteID))) {
                        createWidgetError(id);
                        return;
                    } else currentSettings.siteID = parseInt(currentSettings.siteID);
                }

                // map each member's status depending on siteID setting
                if (currentSettings.siteID) {
                    Object.values(copiedData).map(member => {
                        if (member.current_site_id != currentSettings.siteID) member.status = "signed_out";
                        return member;
                    })
                }

                // fitler out any 'signed_out' members if 'showSignedOut' has been set to false
                if (currentSettings.showSignedOut === 'false') {
                    Object.keys(copiedData).map(key => {
                        if (copiedData[key].status !== 'signed_in') delete copiedData[key];
                    });
                }

                // set height
                let newHeight = self.getHeight()*60;
                if (currentSettings.title && currentSettings.title.trim()) newHeight -= 40
                $(tableWrapper)[0].style.height = newHeight + "px";

                const keys = Object.keys(copiedData);

                // add members data to table
                for (let x = 0; x < Math.ceil(Object.keys(copiedData).length/maxColumns); x++) {
                    const row = $('<tr></tr>');
                    let rowMembers = [];
                    for (let y = 0; y < maxColumns; y++) {
                        const index = (x * maxColumns) + y;
                        rowMembers.push(keys[index]);
                    }

                    rowMembers.forEach((name) => {
                        const member = copiedData[name];
                        if (member === undefined) return;
                        const imageSrc = member.photo_url ? member.photo_url : 'https://www.gravatar.com/avatar/?d=mp';
                        const imageElement = `<img class="members-img" src="${imageSrc}" width="40" height="40" />`
                        const spanElement = `<span class="${member.status === "signed_in" ? "online-dot" : ""}" />`
                        const imageCell = `<td class="cell-fit-content">${imageElement + spanElement}</td>`
                        let textCell;
                        if (currentSettings.showSiteNames === 'true' && member.current_site_name != null) {
                            textCell = `<td style="white-space: pre; font-size: 15px;">${trimName(name, 22)}\n${trimName(member.current_site_name, 22)}</td>`
                        } else {
                            textCell = `<td style="white-space: pre; font-size: 15px;">${trimName(name, 22)}</td>`
                        }
                        $(row).append(imageCell);
                        $(row).append(textCell);
                    });

                    $(membersTable).append(row);
                }
            } else {
                createWidgetError(id);
            }
        }

        function sourceIsValid(members) {
            let validKeys = true;
            try {
                for (const [name, data] of Object.entries(members)) {
                    if (!validKeys) return;
                    validKeys = validKeys && (Object.keys(data).length == 4);
                    validKeys = validKeys && data.hasOwnProperty('photo_url')
                        && data.hasOwnProperty('status')
                        && data.hasOwnProperty('current_site_id')
                        && data.hasOwnProperty('current_site_name');
                }
            } catch (e) {
                validKeys = false;
            }
            return validKeys;
        }

        function resizeTable(newValue) {
            const width = document.getElementById(id).clientWidth;
            const newMaxColumns = Math.floor(width / 245);
            if (newMaxColumns !== maxColumns) {
                maxColumns = newMaxColumns; // update max columns
                drawMembersTable(newValue);
                $(tableWrapper).stop();
                scrollToBottom();
            }
        }

        function scrollToBottom() {
            const scrollPos = document.getElementById(id).parentElement.scrollTop;
            const widgetHeight = document.getElementById(id).clientHeight;
            const scrollBottom = widgetHeight - (self.getHeight() * 60) + 100; // +100 is to add a pause at the bottom
            const speed = 20;
            const duration = ((scrollBottom-scrollPos) / speed) * 1000; // the 1000 is to convert from seconds to millis
            $(tableWrapper).animate({scrollTop: scrollBottom}, duration, 'linear', scrollToTop);
        }

        function scrollToTop() {
            const widgetHeight = document.getElementById(id).clientHeight;
            const scrollPos = widgetHeight - (self.getHeight() * 60);
            const speed = 20;
            const duration = (scrollPos / speed) * 1000; // the 1000 is to convert from seconds to millis
            $(tableWrapper).animate({scrollTop: 0}, duration, 'linear');
        }
    }

    // sia graph widget configuration
    freeboard.loadWidgetPlugin({
        "type_name": "sia_graph_widget",
        "display_name": "SIA Graph Widget",
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