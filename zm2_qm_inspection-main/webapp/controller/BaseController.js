sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"sap/ui/core/routing/History",
	"sap/ui/Device"
], function (Controller, UIComponent, History, Device) {
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
		},

		_getSplitApp: function () {
			let oCtrl = this.getView();
			while (oCtrl && !(oCtrl.isA && oCtrl.isA("sap.m.SplitApp"))) {
				oCtrl = oCtrl.getParent();
			}
			return oCtrl;
		},

		//Oeffnet die Master-View. Auf Phone (SplitApp = ein einziger NavContainer) muss explizit
		//zur Master-Page navigiert werden; auf Tablet/Desktop reicht showMaster() (Popover bzw. no-op).
		onShowMaster: function () {
			const oSplitApp = this._getSplitApp();
			if (!oSplitApp) {
				return;
			}
			if (Device.system.phone) {
				const aMasters = oSplitApp.getMasterPages();
				if (aMasters && aMasters.length > 0) {
					oSplitApp.toMaster(aMasters[0].getId());
				}
			} else {
				oSplitApp.showMaster();
			}
		},

		//Gegenstueck: von der Master-View zurueck zur Detail/Empty-View.
		onShowDetail: function () {
			const oSplitApp = this._getSplitApp();
			if (!oSplitApp) {
				return;
			}
			if (Device.system.phone) {
				const aDetails = oSplitApp.getDetailPages();
				if (aDetails && aDetails.length > 0) {
					//Letzte navigierte Detail-Seite ist die zuletzt zugefuegte
					oSplitApp.toDetail(aDetails[aDetails.length - 1].getId());
				}
			} else {
				oSplitApp.hideMaster();
			}
		}

	});
});
