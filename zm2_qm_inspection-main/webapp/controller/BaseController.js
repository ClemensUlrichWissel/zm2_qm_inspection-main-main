sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"sap/ui/core/routing/History"
], function (Controller, UIComponent, History) {
	"use strict";

	return Controller.extend("de.mindsquare.InspectionQM.controller.BaseController", {

		getRouter: function () {
			return UIComponent.getRouterFor(this);
		},

		onNavBack: function () {
			const sPreviousHash = History.getInstance().getPreviousHash();

			if (sPreviousHash !== undefined) {
				window.history.go(-1);
			} else {
				this.getRouter().navTo("RouteMain", {}, true);
			}
		},

		getI18nText: function (sText) {
			return this.getView().getModel("i18n").getResourceBundle().getText(sText);
		}

	});
});
