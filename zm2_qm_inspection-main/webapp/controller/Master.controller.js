sap.ui.define([
	"de/mindsquare/InspectionQM/controller/BaseController",
	"sap/ui/core/Fragment"
], function (Controller, Fragment) {
	"use strict";

	return Controller.extend("de.mindsquare.InspectionQM.controller.Master", {

		onInit: function () {
			//model for filtering is created so every selection for filtering will be saved
			this.getView().setModel(new sap.ui.model.json.JSONModel({
				plant: [],
				workplace: [],
				material: []
			}), "FilterModel");
		},

		onAfterRendering: function () {
			// this.onOpenFilterDialog();
		},

		onSearch: function (oEvent) {
			// var sValue = oEvent.getParameter("query");
			var sValue = this.getView().byId('idSearch').getValue();
			var oList = this.getView().byId('idInspectionLotList');

			if (sValue)
				oList.getBinding('items').filter(new sap.ui.model.Filter("InspectionLotNumber", "Contains", sValue));
			else
				oList.getBinding('items').filter();
		},

		onBarcodeScanSuccess: function (oEvent) {
			var oSearch = this.getView().byId('idSearch');
			var sText = oEvent.getParameter("text");

			oSearch.setValue(sText);
			oSearch.fireSearch();
		},

		// onOpenFilterDialog: function () {
		// 	var oView = this.getView();

		// 	if (!this.pDialog) {
		// 		this.pDialog = Fragment.load({
		// 			id: oView.getId(),
		// 			controller: this,
		// 			name: "de.mindsquare.InspectionQM.view.fragments.DialogFilters"
		// 		}).then(function (oDialog) {
		// 			oView.addDependent(oDialog);
		// 			return oDialog;
		// 		});
		// 	}

		// 	this.pDialog.then(function (oDialog) {
		// 		this._oFilterDialog = oDialog;
		// 		oDialog.open();
		// 	}.bind(this));
		// },

		onApplyFilters: function () {
			var oList = this.getView().byId('idInspectionLotList');
			var aFilters = [];

			this.getView().getModel("FilterModel").getProperty("/workplace").forEach(function (item) {
				aFilters.push(new sap.ui.model.Filter("Workcenter", "EQ", item.text));
			});

			// if (!aFilters.length) {
			// 	sap.m.MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("no-workplace-filter"));
			// 	return;
			// }

			this.getView().getModel("FilterModel").getProperty("/material").forEach(function (item) {
				aFilters.push(new sap.ui.model.Filter("Material", "EQ", item.text));
			});

			this.getView().getModel("FilterModel").getProperty("/plant").forEach(function (item) {
				aFilters.push(new sap.ui.model.Filter("Werks", "EQ", item.text));
			});

			oList.getBinding("items").filter(aFilters, "Application");

			// this._oFilterDialog.close();
		},

		// onCancelFilters: function () {
		// 	this._oFilterDialog.close();
		// },

		onSubmitFilter: function (oEvent) {
			const sValue = oEvent.getParameter("value");
			const sPath = oEvent.getSource().getBinding("tokens").getPath();
			const oModel = this.getView().getModel("FilterModel");
			let arr = oModel.getProperty(sPath);

			// Set text as token
			if (sValue) {
				arr.push({ text: sValue });
				oModel.setProperty(sPath, arr);
				oEvent.getSource().setValue("");
			}

			// Apply filters after adding new token
			this.onApplyFilters();
		},

		onTokenUpdate: function (oEvent) {
			const oModel = this.getView().getModel("FilterModel");
			const sPath = oEvent.getParameter("removedTokens")[0].getBindingContext("FilterModel").getPath();
			const aProp = sPath.split("/");
			let arr = oModel.getProperty("/" + aProp[1]);

			arr.splice(aProp[2], 1);
			oModel.setProperty("/" + aProp[1], arr);
		},

		onSelectionChange: function (oEvent) {
			var sInspectionLot = oEvent.getSource().getBindingContext().getObject().InspectionLotNumber;

			this.getView().getModel().resetChanges();
			this.getRouter().navTo("InspectionLotDetail", {
				LotNumber: sInspectionLot
			}, true);
		}

	});

});