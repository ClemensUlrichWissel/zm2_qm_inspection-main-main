sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History"
], function (Controller, History) {
	"use strict";

	return Controller.extend("de.mindsquare.InspectionQM.controller.BaseController", {
		
		getRouter: function () {
			return sap.ui.core.UIComponent.getRouterFor(this);
		},
		
		onNavBack: function (oEvent) {
			//TBD
		},

		getI18nText: function (sText) {
			return this.getView().getModel("i18n").getResourceBundle().getText(sText);
		}
		
	});
});