sap.ui.define([
	"de/mindsquare/InspectionQM/controller/BaseController",
	"sap/ui/core/Fragment",
	"sap/ui/core/Item",
	"sap/ui/core/format/DateFormat",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/m/Popover",
	"sap/m/TextArea"
], function (BaseController, Fragment, Item, DateFormat, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, Popover, TextArea) {
	"use strict";

	return BaseController.extend("de.mindsquare.InspectionQM.controller.Detail", {

		onInit: function () {
			this.getRouter().getRoute("InspectionLotDetail").attachMatched(this._onRouteMatched, this);
			this._bPropertyChangeAttached = false;
		},

		_onRouteMatched: function (oEvent) {
			const sLotNumber = oEvent.getParameter("arguments").LotNumber;
			const oView = this.getView();
			const oModel = oView.getModel();

			oModel.metadataLoaded().then(() => {
				//Attach property change listener exactly once - whenever a TwoWay-bound property changes,
				//submit the pending changes immediately. Guarded by a flag so re-entering the route does not
				//attach the listener multiple times (which would cause N submits per change).
				if (!this._bPropertyChangeAttached) {
					oView.setBusyIndicatorDelay(0);
					oModel.attachPropertyChange(() => {
						oView.setBusy(true);
						oModel.submitChanges({
							success: () => oView.setBusy(false),
							error: () => oView.setBusy(false)
						});
					});
					this._bPropertyChangeAttached = true;
				}

				const sPath = "/" + oModel.createKey("InspectionLotSet", {
					InspectionLotNumber: sLotNumber
				});
				oView.bindElement(sPath);
				//TS, 10.06.2022, Refresh element binding to update flags like HasUsageDecision when re-opening lots
				oView.getElementBinding().refresh();
			});
		},

		_setEvaluationCode: function (oCtx, sNewValue) {
			const oModel = this.getView().getModel();
			const oView = this.getView();

			oModel.setProperty(oCtx.getPath() + "/Code1", sNewValue);
			oView.setBusy(true);
			oModel.submitChanges({
				success: () => oView.setBusy(false),
				error: () => oView.setBusy(false)
			});
		},

		onSelectYes: function (oEvent) {
			const oCtx = oEvent.getSource().getBindingContext();
			const oResBundle = this.getView().getModel("i18n").getResourceBundle();
			const sXOK = oResBundle.getText("XOK");
			const sXNOK = oResBundle.getText("XNOK");
			const sCurrent = oCtx.getObject().Code1;

			//Toggle: deselect if already YES, otherwise set to YES
			const sValue = sCurrent === sXOK ? "" : sXOK;
			this._setEvaluationCode(oCtx, sValue);
		},

		onSelectNo: function (oEvent) {
			const oCtx = oEvent.getSource().getBindingContext();
			const oResBundle = this.getView().getModel("i18n").getResourceBundle();
			const sXOK = oResBundle.getText("XOK");
			const sCurrent = oCtx.getObject().Code1;

			//"Currently No" = Code1 ist gesetzt und nicht der OK-Code
			const bCurrentlyNo = !!sCurrent && sCurrent !== sXOK;

			if (bCurrentlyNo) {
				//Toggle off -> Code1 leeren (kein Speichern eines spezifischen Codes mehr)
				this._setEvaluationCode(oCtx, "");
			} else {
				//Fehlerart-Dialog öffnen; Code1 wird erst nach Auswahl auf der Charakteristik gesetzt
				this._openDefectCodeDialog(oCtx.getPath(), oCtx);
			}
		},

		/**
		 * Öffnet den Fehlerart-Dialog.
		 * @param {string} sCharPath Pfad zur Eltern-Charakteristik (für die toDefectCodes-Navigation)
		 * @param {sap.ui.model.Context} oTargetCtx Kontext, auf dem Code1 nach Auswahl gespeichert wird
		 */
		_openDefectCodeDialog: function (sCharPath, oTargetCtx) {
			Fragment.load({
				name: "de.mindsquare.InspectionQM.view.fragments.DialogDefectCode",
				controller: this
			}).then((oDialog) => {
				//Dialog an die Charakteristik binden -> ComboBox-Items lösen toDefectCodes korrekt auf
				oDialog.bindElement(sCharPath);
				//Speicher-Ziel separat merken (kann eine single_result-Zeile sein)
				oDialog._oTargetCtx = oTargetCtx;
				this.getView().addDependent(oDialog);
				oDialog.open();
			});
		},

		/**
		 * Baut den Charakteristik-Pfad aus den Keys einer Charakteristik- oder single_result-Context-Zeile.
		 */
		_getCharacteristicPath: function (oCtx) {
			const oModel = this.getView().getModel();
			return "/" + oModel.createKey("InspectionLotCharacteristicSet", {
				InspCharacteristic: oCtx.getProperty("InspCharacteristic"),
				InspectionLot:      oCtx.getProperty("InspectionLot"),
				InspLotAction:      oCtx.getProperty("InspLotAction"),
				InspSample:         oCtx.getProperty("InspSample")
			});
		},

		onDefectCodeSearch: function (oEvent) {
			const sQuery = oEvent.getParameter("value") || oEvent.getParameter("newValue") || "";
			const oBinding = oEvent.getSource().getBinding("items");
			if (!oBinding) {
				return;
			}
			if (sQuery) {
				const aFilters = [
					new Filter("Code", FilterOperator.Contains, sQuery),
					new Filter("Description", FilterOperator.Contains, sQuery),
					new Filter("CodeGroup", FilterOperator.Contains, sQuery)
				];
				oBinding.filter(new Filter({ filters: aFilters, and: false }));
			} else {
				oBinding.filter([]);
			}
		},

		onDefectCodeConfirm: function (oEvent) {
			const oDialog = oEvent.getSource().getParent();
			const oComboBox = oDialog.getContent()[0].getItems()[1];
			const sCode = oComboBox.getSelectedKey();

			if (!sCode) {
				MessageToast.show(this.getI18nText("defectCodeRequired"));
				return;
			}

			//Ziel-Context wurde beim Öffnen explizit gemerkt (kann Char- oder single_result-Zeile sein)
			const oTargetCtx = oDialog._oTargetCtx;
			if (!oTargetCtx) {
				oDialog.destroy();
				return;
			}

			this._setEvaluationCode(oTargetCtx, sCode);
			oDialog.destroy();
		},

		onDefectCodeCancel: function (oEvent) {
			oEvent.getSource().getParent().destroy();
		},

		onPressCharacteristic: function (oEvent) {
			const oPopover = new Popover({
				placement: "PreferredBottomOrFlip",
				title: this.getI18nText("longtext"),
				titleAlignment: "Center",
				content: [
					new TextArea({
						editable: false,
						value: "{CharactLongtext}",
						rows: 7,
						width: "400px"
					})
				]
			});

			oPopover.setModel(this.getView().getModel());
			oPopover.setBindingContext(oEvent.getSource().getBindingContext());
			oPopover.openBy(oEvent.getSource());
		},

		onPressSampleResults: function (oEvent) {
			const oCtx = oEvent.getSource().getBindingContext();

			Fragment.load({
				name: "de.mindsquare.InspectionQM.view.fragments.DialogSingleResults",
				controller: this
			}).then((oDialog) => {
				oDialog.setBindingContext(oCtx);
				this.getView().addDependent(oDialog);
				oDialog.open();
			});
		},

		onCloseSingleResults: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onSelectYesSingleResult: function (oEvent) {
			const oCtx = oEvent.getSource().getBindingContext();
			const sXOK = this.getView().getModel("i18n").getResourceBundle().getText("XOK");
			const sCurrent = oCtx.getObject().Code1;

			//Toggle: deselect wenn bereits Yes, sonst auf Yes setzen
			const sValue = sCurrent === sXOK ? "" : sXOK;
			this._setEvaluationCode(oCtx, sValue);
		},

		onSelectNoSingleResult: function (oEvent) {
			const oCtx = oEvent.getSource().getBindingContext();
			const sXOK = this.getView().getModel("i18n").getResourceBundle().getText("XOK");
			const sCurrent = oCtx.getObject().Code1;

			const bCurrentlyNo = !!sCurrent && sCurrent !== sXOK;

			if (bCurrentlyNo) {
				//Toggle off
				this._setEvaluationCode(oCtx, "");
			} else {
				//Codes hängen an der Charakteristik (toDefectCodes), gespeichert wird aber auf der single_result-Zeile
				const sCharPath = this._getCharacteristicPath(oCtx);
				this._openDefectCodeDialog(sCharPath, oCtx);
			}
		},

		onPressComment: function (oEvent) {
			const oCtx = oEvent.getSource().getBindingContext();

			Fragment.load({
				name: "de.mindsquare.InspectionQM.view.fragments.DialogComment",
				controller: this
			}).then((oDialog) => {
				this.getView().addDependent(oDialog);
				oDialog.getContent()[0].setValue(oCtx.getProperty("CharComment"));
				oDialog._oCtx = oCtx;
				oDialog.open();
			});
		},

		onAcceptComment: function (oEvent) {
			const oDialog = oEvent.getSource().getParent();
			const sPath = oDialog._oCtx.getPath();

			oDialog.getModel().setProperty(sPath + "/CharComment", oDialog.getContent()[0].getValue());
			oDialog.getModel().submitChanges();
			oDialog.close();
		},

		onCancelComment: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onAddNewSample: function () {
			const oCtx = this.getView().getBindingContext();

			Fragment.load({
				name: "de.mindsquare.InspectionQM.view.fragments.DialogNewSample",
				controller: this
			}).then((oDialog) => {
				this.getView().addDependent(oDialog);
				oDialog.setBindingContext(oCtx);
				oDialog.open();
			});
		},

		onPressDialogNewSampleClose: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onPressDialogNewSampleConfirm: function (oEvent) {
			const oSimpleForm = oEvent.getSource().getParent().getContent()[0];
			const oSelect = oSimpleForm.getContent()[1];
			const sOperation = oSelect.getSelectedKey();
			const oModel = this.getView().getModel();
			const oCtx = this.getView().getBindingContext();
			const oDialog = oEvent.getSource().getParent();

			oModel.callFunction("/CreateNewSample", {
				refreshAfterChange: true,
				method: "POST",
				urlParameters: {
					InspectionLot: oCtx.getObject().InspectionLotNumber,
					InspLotAction: sOperation
				},
				success: () => oDialog.close(),
				error: (oError) => {
					MessageBox.error(this.getI18nText("errorText"));
				}
			});
		},

		onAddNewInspPoint: function () {
			const oCtx = this.getView().getBindingContext();

			Fragment.load({
				name: "de.mindsquare.InspectionQM.view.fragments.DialogNewInspPoint",
				controller: this
			}).then((oDialog) => {
				this.getView().addDependent(oDialog);
				oDialog.setBindingContext(oCtx);
				oDialog.open();
			});
		},

		onPressDialogNewInspPointClose: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onPressDialogNewInspPointConfirm: function (oEvent) {
			const oDialog = oEvent.getSource().getParent();
			const aFormContent = oDialog.getContent()[0].getContent();
			// SimpleForm rendering order: [0] Label, [1] Operation-Select
			const sOperation = aFormContent[1].getSelectedKey();
			const oModel = this.getView().getModel();
			const oCtx = this.getView().getBindingContext();
			// Usern2 (Prüfart) wird aus dem Lot-Header übernommen
			const sUsern2 = oCtx.getObject().Usern2;

			if (!sOperation) {
				MessageToast.show(this.getI18nText("selectOperationForNewInspPoint"));
				return;
			}
			if (!sUsern2) {
				MessageToast.show(this.getI18nText("inspectionTypeRequired"));
				return;
			}

			oDialog.setBusyIndicatorDelay(0);
			oDialog.setBusy(true);

			oModel.callFunction("/CreateInspPoint", {
				refreshAfterChange: true,
				method: "POST",
				urlParameters: {
					InspectionLot: oCtx.getObject().InspectionLotNumber,
					InspLotAction: sOperation,
					Usern2: sUsern2
				},
				success: () => {
					oDialog.setBusy(false);
					oDialog.close();
					MessageToast.show(this.getI18nText("inspPointCreated"));
				},
				error: () => {
					oDialog.setBusy(false);
					//Detailed error message comes via the central ErrorHandling.js
				}
			});
		},

		onUsageDecision: function () {
			const oCtx = this.getView().getBindingContext();
			const oModel = new JSONModel();
			const oList = this.getView().byId("idMainList");
			let bOpened = false;

			oList.getItems().forEach((item) => {
				item.getContent()[0].getItems()[1].getItems().forEach((child) => {
					const oCtxChild = child.getContent()[0].getBindingContext();
					const bClosed = oCtxChild.getProperty("Closed");
					const bObligatory = oCtxChild.getProperty("Obligatory");

					if (!bClosed && bObligatory) bOpened = true;
				});
			});

			const openDialog = () => {
				//All the values for decision are kept in another model because it will be saved to FI
				oModel.setProperty("/DefaultStorageLoc", oCtx.getProperty("DefaultStorageLoc"));
				oModel.setProperty("/IsStockRelevant", oCtx.getProperty("IsStockRelevant"));
				oModel.setProperty("/InspectionLot", oCtx.getProperty("InspectionLotNumber"));
				oModel.setProperty("/Comment", "");
				oModel.setProperty("/Decision", "");

				Fragment.load({
					name: "de.mindsquare.InspectionQM.view.fragments.DialogUsageDecision",
					controller: this
				}).then((oDialog) => {
					this.getView().addDependent(oDialog);
					oDialog.setModel(oModel, "DecisionModel");
					oDialog.open();
				});
			};

			if (bOpened) {
				MessageBox.warning(this.getI18nText("still-opened"), {
					actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
					emphasizedAction: MessageBox.Action.OK,
					onClose: (sAction) => {
						if (sAction === "OK") openDialog();
					}
				});
			} else {
				openDialog();
			}
		},

		onAcceptDecision: function (oEvent) {
			const oDialog = oEvent.getSource().getParent();
			const oModel = oDialog.getModel("DecisionModel");
			const oDataModel = this.getView().getModel();

			oDialog.setBusyIndicatorDelay(0);
			oDialog.setBusy(true);

			if (oModel.getProperty("/IsStockRelevant") && !oModel.getProperty("/DefaultStorageLoc")) {
				MessageToast.show(this.getI18nText("funcloc-required"));
				oDialog.setBusy(false);
				return;
			}

			const oData = {
				InspectionLot: oModel.getProperty("/InspectionLot"),
				UsageDecisionKey: oModel.getProperty("/Decision"),
				StorageLocation: oModel.getProperty("/DefaultStorageLoc"),
				Comment: oModel.getProperty("/Comment")
			};

			oDataModel.callFunction("/PostUsageDecision", {
				refreshAfterChange: true,
				method: "POST",
				urlParameters: oData,
				success: () => {
					oDialog.setBusy(false);
					oDialog.close();
					this.getView().unbindElement();
					//TS, 10.06.2022, Navigate to allow re-opening of inspection lot with long term characteristics
					this.getRouter().navTo("RouteMain", {}, true);
				},
				error: () => oDialog.setBusy(false)
			});
		},

		onRejectDecision: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onCloseAccept: function (oEvent) {
			this.callCloseChar("A", oEvent.getSource().getBindingContext());
		},

		onCloseReject: function (oEvent) {
			this.callCloseChar("R", oEvent.getSource().getBindingContext());
		},

		onClose: function (oEvent) {
			this.callCloseChar(" ", oEvent.getSource().getBindingContext());
		},

		onCloseOperation: function (oEvent) {
			//Close all characteristics at once
			//Don't send a characteristic ID - the backend closes all characteristics for the operation
			//Action binding context already has InspectionLot, InspLotAction, InspSample - no DOM traversal needed
			const oCtx = oEvent.getSource().getBindingContext();
			if (!oCtx) {
				return;
			}
			this.callCloseChar(" ", oCtx, false);
		},

		callCloseChar: function (type, ctx, bSendChar = true) {
			const oModel = this.getView().getModel();
			const oData = {
				InspCharacteristic: bSendChar ? ctx.getProperty("InspCharacteristic") : "",
				InspLotAction: ctx.getProperty("InspLotAction"),
				InspSample: ctx.getProperty("InspSample"),
				InspectionLot: ctx.getProperty("InspectionLot"),
				Evaluation: type
			};

			oModel.callFunction("/CloseCharacteristic", {
				refreshAfterChange: true,
				method: "POST",
				urlParameters: oData
			});
		},

		onBeforeUploadStarts: function (oEvent) {
			const oUploadSet = oEvent.getSource();
			const sCsrfToken = this.getView().getModel().getSecurityToken();
			const oCtx = this.getView().getBindingContext();
			const sSlug = oCtx.getObject().InspectionLotNumber + "|" + oEvent.getParameter("item").getProperty("fileName");

			this._addUploadHeaderField("x-csrf-token", sCsrfToken, oUploadSet);
			this._addUploadHeaderField("slug", sSlug, oUploadSet);
		},

		_addUploadHeaderField: function (sHeaderName, sValue, oUploadSet) {
			const aHeaderFields = oUploadSet.getHeaderFields();
			const oExisting = aHeaderFields.find((oField) => oField.getKey() === sHeaderName);

			if (oExisting) {
				oExisting.setText(sValue);
			} else {
				oUploadSet.addHeaderField(new Item({
					key: sHeaderName,
					text: sValue
				}));
			}
		},

		onUploadCompleted: function (oEvent) {
			oEvent.getSource().removeAllIncompleteItems();
			oEvent.getSource().getBinding("items").refresh();
		},

		onAfterItemRemoved: function (oEvent) {
			const oCtx = oEvent.getParameter("item").getBindingContext();
			const oModel = this.getView().getModel();
			const sPath = "/" + oModel.createKey("InspectionLotAttachmentSet", {
				InspectionLot: oCtx.getObject().InspectionLot,
				AttachmentId: oCtx.getObject().AttachmentId
			});

			//Store reference to the deleted item because the UploadSet does not destroy it after deletion
			this._oItemDeleted = oEvent.getParameter("item");

			oModel.remove(sPath, {
				success: () => {
					//Destroy the item to prevent duplicated ID errors
					this._oItemDeleted.destroy();
				},
				error: () => {
					MessageBox.error(this.getI18nText("errorText"));
				}
			});
		},

		formatOperationTitle: function (sOperation, sOperationText, sWorkcenter, sWorkcenterText, sControlKey, sUsern1,
			sPhysSample, dUserDate, dUserTime) {
			let sTitle = this.getI18nText("operation") + " " + sOperation + " " + sOperationText;

			if (sPhysSample || (dUserDate && dUserTime)) {
				//Staedtler test cases
				if (sPhysSample) {
					sTitle = sTitle + " | " + this.getI18nText("sample") + " " + sPhysSample;
				}

				if (dUserDate && dUserTime) {
					sTitle = sTitle + " | " + DateFormat.getDateInstance().format(dUserDate) +
						" / " + DateFormat.getTimeInstance().format(new Date(dUserTime.ms), true);
				}
			} else {
				//IDES7 test cases
				if (sUsern1 && sUsern1 !== "0000000000") {
					sTitle = sTitle + " | " + this.getI18nText("container") + " " + sUsern1;
				}
			}

			sTitle = sTitle + " | " + this.getI18nText("workcenter") + " " + sWorkcenter + " " + sWorkcenterText;

			if (sControlKey) {
				sTitle = sTitle + " | " + this.getI18nText("controlKey") + " " + sControlKey;
			}

			return sTitle;
		},

		/**
		 * Parses a number string that may use either '.' or ',' as decimal separator.
		 * @private
		 */
		_parseNumber: function (sNum) {
			if (sNum === null || sNum === undefined || sNum === "") {
				return NaN;
			}
			return parseFloat(String(sNum).replace(",", "."));
		},

		/**
		 * Returns true if the value is outside the [lower, upper] range.
		 * Only triggers when BOTH limits are present (user requirement).
		 * @private
		 */
		_isOutsideTolerance: function (sValue, sLowerLimit, sUpperLimit) {
			if (!sValue || !sLowerLimit || !sUpperLimit) {
				return false;
			}
			const fValue = this._parseNumber(sValue);
			const fLower = this._parseNumber(sLowerLimit);
			const fUpper = this._parseNumber(sUpperLimit);
			if (isNaN(fValue) || isNaN(fLower) || isNaN(fUpper)) {
				return false;
			}
			return fValue < fLower || fValue > fUpper;
		},

		/**
		 * ValueState formatter for the quantitative single-result input in the characteristic row.
		 * Returns 'Error' when value is outside tolerance, 'None' otherwise.
		 */
		formatValueState: function (sValue, sLowerLimit, sUpperLimit) {
			return this._isOutsideTolerance(sValue, sLowerLimit, sUpperLimit) ? "Error" : "None";
		},

		/**
		 * ValueState formatter for the single-result inputs in DialogSingleResults.
		 * The tolerance limits live on the parent characteristic entity - looked up via OData cache.
		 */
		formatSingleResultValueState: function (sValue, sInspChar, sInspLot, sInspLotAction, sInspSample) {
			if (!sValue || !sInspChar) {
				return "None";
			}
			const oModel = this.getView().getModel();
			if (!oModel) {
				return "None";
			}
			const sCharPath = "/" + oModel.createKey("InspectionLotCharacteristicSet", {
				InspCharacteristic: sInspChar,
				InspectionLot: sInspLot,
				InspLotAction: sInspLotAction,
				InspSample: sInspSample
			});
			const sLowerLimit = oModel.getProperty(sCharPath + "/LwTolLmt");
			const sUpperLimit = oModel.getProperty(sCharPath + "/UpTolLmt");
			return this._isOutsideTolerance(sValue, sLowerLimit, sUpperLimit) ? "Error" : "None";
		},

		/**
		 * Determines whether a characteristic row is editable.
		 * Only QM92 operations are editable. For other QMxx the controls are visible but disabled.
		 * The parent operation's ControlKey is looked up via the OData cache.
		 */
		isCharEditable: function (bSkipped, bClosed, sLotAction, sInspectionLot, sInspSample) {
			if (bSkipped || bClosed) {
				return false;
			}

			const oModel = this.getView().getModel();
			if (!oModel || !sLotAction || !sInspectionLot) {
				return false;
			}

			const sActionPath = "/" + oModel.createKey("InspectionLotActionSet", {
				InspectionLot: sInspectionLot,
				InspLotAction: sLotAction,
				InspSample: sInspSample
			});

			const sControlKey = oModel.getProperty(sActionPath + "/ControlKey");
			return sControlKey === "QM92";
		},

		formatCharacteristicTitle: function (sCharateristic, sMasterCharacteristic, sCharacteristicText,
			sTargetValue, sUpperLimit, sLowerLimit, sChararcteristicType, sUnitText, sScope) {
			let sTitle = sCharateristic;

			sTitle = sTitle + " | " + (sMasterCharacteristic || "-");
			sTitle = sTitle + " | " + sCharacteristicText;

			if (parseInt(sScope, 10) > 1) {
				sTitle = sTitle + " | " + this.getI18nText("scope") + ": " + parseInt(sScope, 10);
			}

			if (sChararcteristicType === "01") {
				//Quantitative characteristic - add target value and limits
				if (sTargetValue) {
					sTitle = sTitle + " (" + this.getI18nText("target") + ": " + sTargetValue;

					if (sUnitText) {
						sTitle = sTitle + " " + sUnitText;
					}

					if (sLowerLimit && sUpperLimit) {
						sTitle = sTitle + ", " + this.getI18nText("tolerance") + ": " +
							sLowerLimit + " - " + sUpperLimit + ")";
					}
				} else if (sLowerLimit && sUpperLimit) {
					sTitle = sTitle + " (" + this.getI18nText("tolerance") + ": " +
						sLowerLimit + " - " + sUpperLimit;

					if (sUnitText) {
						sTitle = sTitle + " " + sUnitText;
					}

					sTitle = sTitle + ")";
				}
			}

			return sTitle;
		}

	});

});
