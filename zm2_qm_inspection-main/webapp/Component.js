sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"de/mindsquare/InspectionQM/model/models",
	"./model/ErrorHandling"
], function (UIComponent, Device, models, errorHandling) {
	"use strict";

	return UIComponent.extend("de.mindsquare.InspectionQM.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// enable routing
			this.getRouter().initialize();

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
			
			errorHandling.register(this);
		}
	});
});