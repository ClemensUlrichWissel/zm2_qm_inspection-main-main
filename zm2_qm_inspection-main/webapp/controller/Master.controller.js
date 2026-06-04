sap.ui.define([
	"de/mindsquare/InspectionQM/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/Sorter"
], function (BaseController, JSONModel, Filter, FilterOperator, Sorter) {
	"use strict";

	//Order in which active sort fields are applied to the list binding
	const SORT_FIELD_ORDER = ["Werks", "Workcenter", "Material"];

	return BaseController.extend("de.mindsquare.InspectionQM.controller.Master", {

		onInit: function () {
			//model for filtering is created so every selection for filtering will be saved
			this.getView().setModel(new JSONModel({
				plant: [],
				workplace: [],
				material: [],
				sort: {
					Werks: "asc",
					Workcenter: "",
					Material: ""
				}
			}), "FilterModel");

			//Holds the distinct suggestion values derived from the currently loaded inspection lots
			this.getView().setModel(new JSONModel({
				plant: [],
				workplace: [],
				material: []
			}), "Suggest");

			this._bInitialSortApplied = false;
		},

		//Rebuild the type-ahead suggestions from the loaded inspection lots whenever the list refreshes.
		//Suggestions therefore only contain values that actually occur in the current list.
		onLotListUpdateFinished: function () {
			const aItems = this.getView().byId("idInspectionLotList").getItems();
			const oPlant = {};
			const oWork = {};
			const oMaterial = {};

			aItems.forEach((oItem) => {
				const oCtx = oItem.getBindingContext();
				if (!oCtx) {
					return;
				}
				const oData = oCtx.getObject();
				if (oData.Werks) {
					oPlant[oData.Werks] = true;
				}
				if (oData.Workcenter) {
					oWork[oData.Workcenter] = true;
				}
				if (oData.Material) {
					oMaterial[oData.Material] = oData.MaterialText || "";
				}
			});

			const oSuggest = this.getView().getModel("Suggest");
			oSuggest.setProperty("/plant", Object.keys(oPlant).sort().map((v) => ({ value: v })));
			oSuggest.setProperty("/workplace", Object.keys(oWork).sort().map((v) => ({ value: v })));
			oSuggest.setProperty("/material", Object.keys(oMaterial).sort().map((v) => ({ value: v, text: oMaterial[v] })));
		},

		onBeforeRendering: function () {
			//Apply initial sort exactly once - the list binding only exists after the view is rendered
			if (this._bInitialSortApplied) {
				return;
			}
			const oBinding = this.getView().byId("idInspectionLotList").getBinding("items");
			if (oBinding) {
				this._applySorters();
				this._bInitialSortApplied = true;
			}
		},

		onToggleSort: function (oEvent) {
			const oButton = oEvent.getSource();
			const sField = oButton.data("sortField");
			const oFilterModel = this.getView().getModel("FilterModel");
			const sCurrent = oFilterModel.getProperty("/sort/" + sField);
			//Cycle: none -> asc -> desc -> none
			const sNext = sCurrent === "" ? "asc" : sCurrent === "asc" ? "desc" : "";

			oFilterModel.setProperty("/sort/" + sField, sNext);
			this._applySorters();
		},

		_applySorters: function () {
			const oFilterModel = this.getView().getModel("FilterModel");
			const oSortState = oFilterModel.getProperty("/sort");
			const aSorters = SORT_FIELD_ORDER
				.filter((sField) => oSortState[sField])
				.map((sField) => new Sorter(sField, oSortState[sField] === "desc"));

			this.getView().byId("idInspectionLotList").getBinding("items").sort(aSorters);
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

			if (sValue && !arr.some((oEntry) => oEntry.text === sValue)) {
				arr.push({ text: sValue });
				oModel.setProperty(sPath, arr);
			}
			oEvent.getSource().setValue("");

			this.onApplyFilters();
		},

		//Keep the FilterModel in sync with token add/remove. Tokens are matched by their text value
		//(not by binding context) so this also works for tokens created by selecting a suggestion.
		onTokenUpdate: function (oEvent) {
			const oMultiInput = oEvent.getSource();
			const oTokenBinding = oMultiInput.getBinding("tokens");
			if (!oTokenBinding) {
				return;
			}
			const sPath = oTokenBinding.getPath();            // e.g. "/plant"
			const oModel = this.getView().getModel("FilterModel");
			let aArr = oModel.getProperty(sPath) || [];

			//Remove deleted tokens (matched by value)
			(oEvent.getParameter("removedTokens") || []).forEach((oToken) => {
				const sText = oToken.getText();
				aArr = aArr.filter((oEntry) => oEntry.text !== sText);
			});

			//Add tokens created by selecting a suggestion
			(oEvent.getParameter("addedTokens") || []).forEach((oToken) => {
				const sText = oToken.getText();
				if (sText && !aArr.some((oEntry) => oEntry.text === sText)) {
					aArr.push({ text: sText });
				}
			});

			oModel.setProperty(sPath, aArr);
			oMultiInput.setValue("");
			this.onApplyFilters();
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
