(function()
{
	freeboard.loadDatasourcePlugin({
		"type_name"   : "my_datasource_plugin",
		"display_name": "Datasource Plugin Example",
		"description" : "Some sort of description <strong>with optional html!</strong>",
		"external_scripts" : [
			"http://mydomain.com/myscript1.js",
		    "http://mydomain.com/myscript2.js"
			],
			"settings"    : [
			{
				"name"         : "first_name",
				"display_name" : "First Name",
				"type"         : "text",
				"default_value": "John",
				"description"  : "This is pretty self explanatory..."
			},
			{
				"name"        : "last_name",
				"display_name": "Last Name",
				"type"        : "calculated"
			},
			{
				"name"        : "is_human",
				"display_name": "I am human",
				"type"        : "boolean"
			},
			{
				"name"        : "age",
				"display_name": "Your age",
				"type"        : "option",
				"options"     : [
					{
						"name" : "0-50",
						"value": "young"
					},
					{
						"name" : "51-100",
						"value": "old"
					}
				]
			},
			{
				"name"        : "other",
				"display_name": "Other attributes",
				"type"        : "array",
				"settings"    : [
					{
						"name"        : "name",
						"display_name": "Name",
						"type"        : "text"
					},
					{
						"name"        : "value",
						"display_name": "Value",
						"type"        : "text"
					}
				]
			},
			{
				"name"         : "refresh_time",
				"display_name" : "Refresh Time",
				"type"         : "text",
				"description"  : "In milliseconds",
				"default_value": 5000
			}
		],
		newInstance   : function(settings, newInstanceCallback, updateCallback)
		{
			newInstanceCallback(new myDatasourcePlugin(settings, updateCallback));
		}
	});
	
	var myDatasourcePlugin = function(settings, updateCallback)
	{
		var self = this;
		var currentSettings = settings;

		/* This is some function where I'll get my data from somewhere */
		function getData()
		{
			var newData = { hello : "world! it's " + new Date().toLocaleTimeString() }; // Just putting some sample data in for fun.

			/* Get my data from somewhere and populate newData with it... Probably a JSON API or something. */
			/* ... */
			updateCallback(newData);
		}
		var refreshTimer;

		function createRefreshTimer(interval)
		{
			if(refreshTimer)
			{
				clearInterval(refreshTimer);
			}

			refreshTimer = setInterval(function()
			{
				getData();
			}, interval);
		}
		self.onSettingsChanged = function(newSettings)
		{
			currentSettings = newSettings;
		}
		self.updateNow = function()
		{
			getData();
		}
		self.onDispose = function()
		{
			clearInterval(refreshTimer);
			refreshTimer = undefined;
		}
		createRefreshTimer(currentSettings.refresh_time);
	}
	
	freeboard.loadWidgetPlugin({
		"type_name"   : "my_widget_plugin",
		"display_name": "Widget Plugin Example",
        "description" : "Some sort of description <strong>with optional html!</strong>",
		"external_scripts": [
			"http://mydomain.com/myscript1.js", "http://mydomain.com/myscript2.js"
		],
		"fill_size" : false,
		"settings"    : [
			{
				"name"        : "the_text",
				"display_name": "Some Text",
				"type"        : "calculated"
			},
			{
				"name"        : "size",
				"display_name": "Size",
				"type"        : "option",
				"options"     : [
					{
						"name" : "Regular",
						"value": "regular"
					},
					{
						"name" : "Big",
						"value": "big"
					}
				]
			}
		],
		
		newInstance   : function(settings, newInstanceCallback)
		{
			newInstanceCallback(new myWidgetPlugin(settings));
		}
	});
	
	var myWidgetPlugin = function(settings)
	{
		var self = this;
		var currentSettings = settings;
		var myTextElement = $("<span></span>");
		self.render = function(containerElement)
		{
			$(containerElement).append(myTextElement);
		}
		self.getHeight = function()
		{
			if(currentSettings.size == "big")
			{
				return 2;
			}
			else
			{
				return 1;
			}
		}
		self.onSettingsChanged = function(newSettings)
		{
			currentSettings = newSettings;
		}
		
		self.onCalculatedValueChanged = function(settingName, newValue)
		{
			if(settingName == "the_text")
			{
				$(myTextElement).html(newValue);
			}
		}
		self.onDispose = function()
		{
		}
	}
}());
	