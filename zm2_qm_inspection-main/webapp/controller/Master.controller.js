sap.ui.define([
	"de/mindsquare/InspectionQM/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (BaseController, JSONModel, Filter, FilterOperator) {
	"use strict";

	return BaseController.extend("de.mindsquare.InspectionQM.controller.Master", {

		onInit: function () {
			//model for filtering is created so every selection for filtering will be saved
			this.getView().setModel(new JSONModel({
				plant: [],
				workplace: [],
				material: []
			}), "FilterModel");
		},

		onSearch: function () {
			const sValue = this.getView().byId("idSearch").getValue();
			const oList = this.getView().byId("idInspectionLotList");

			if (sValue) {
				oList.getBinding("items").filter(new Filter("InspectionLotNumber", FilterOperator.Contains, sValue));
			} else {
				oList.getBinding("items").filter();
			}
		},

		onBarcodeScanSuccess: function (oEvent) {
			const oSearch = this.getView().byId("idSearch");
			const sText = oEvent.getParameter("text");

			oSearch.setValue(sText);
			oSearch.fireSearch();
		},

		onApplyFilters: function () {
			const oList = this.getView().byId("idInspectionLotList");
			const oFilterModel = this.getView().getModel("FilterModel");
			const aFilters = [];

			oFilterModel.getProperty("/workplace").forEach((item) => {
				aFilters.push(new Filter("Workcenter", FilterOperator.EQ, item.text));
			});

			oFilterModel.getProperty("/material").forEach((item) => {
				aFilters.push(new Filter("Material", FilterOperator.EQ, item.text));
			});

			oFilterModel.getProperty("/plant").forEach((item) => {
				aFilters.push(new Filter("Werks", FilterOperator.EQ, item.text));
			});

			oList.getBinding("items").filter(aFilters, "Application");
		},

		onSubmitFilter: function (oEvent) {
			const sValue = oEvent.getParameter("value");
			const sPath = oEvent.getSource().getBinding("tokens").getPath();
			const oModel = this.getView().getModel("FilterModel");
			const arr = oModel.getProperty(sPath);

			if (sValue) {
				arr.push({ text: sValue });
				oModel.setProperty(sPath, arr);
				oEvent.getSource().setValue("");
			}

			this.onApplyFilters();
		},

		onTokenUpdate: function (oEvent) {
			const oModel = this.getView().getModel("FilterModel");
			const sPath = oEvent.getParameter("removedTokens")[0].getBindingContext("FilterModel").getPath();
			const aProp = sPath.split("/");
			const arr = oModel.getProperty("/" + aProp[1]);

			arr.splice(aProp[2], 1);
			oModel.setProperty("/" + aProp[1], arr);
		},

		onSelectionChange: function (oEvent) {
			const sInspectionLot = oEvent.getSource().getBindingContext().getObject().InspectionLotNumber;

			this.getView().getModel().resetChanges();
			this.getRouter().navTo("InspectionLotDetail", {
				LotNumber: sInspectionLot
			}, true);
		}

	});

});
