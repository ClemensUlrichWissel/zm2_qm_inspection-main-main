sap.ui.define([
	"de/mindsquare/InspectionQM/controller/BaseController",
	"sap/ui/core/Fragment",
	"sap/ui/core/Item",
	"sap/ui/core/format/DateFormat",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (BaseController, Fragment, Item, DateFormat, JSONModel, Filter, FilterOperator, MessageBox, MessageToast) {
	"use strict";

	return BaseController.extend("de.mindsquare.InspectionQM.controller.Detail", {

		onInit: function () {
			this.getRouter().getRoute("InspectionLotDetail").attachMatched(this._onRouteMatched, this);
			this._bPropertyChangeAttached = false;
			//UI-Statusmodell (u.a. Hinweis-Strip im Anhänge-Tab)
			this.getView().setModel(new JSONModel({ attachMsg: false, attachMsgText: "" }), "ui");
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
					oModel.attachPropertyChange((oEvent) => {
						//Success toast only for measured-value fields (not inspection type, comment, etc.)
						const sChangedProp = (oEvent.getParameter("path") || "").split("/").pop();
						const bIsResult = ["ResValue", "ValidVals", "Nonconf"].indexOf(sChangedProp) !== -1;
						//Inspection type: the lot's Usern2 is re-derived from the inspection points when read,
						//so the automatic re-read after the change would revert the dropdown. Suppress it for this change.
						const bIsInspType = sChangedProp === "Usern2";

						oView.setBusy(true);
						if (bIsInspType) {
							oModel.setRefreshAfterChange(false);
						}
						oModel.submitChanges({
							success: () => {
								oView.setBusy(false);
								if (bIsInspType) {
									oModel.setRefreshAfterChange(true);
								}
								if (bIsResult) {
									MessageToast.show(this.getI18nText("resultRecorded"));
								}
							},
							error: () => {
								oView.setBusy(false);
								if (bIsInspType) {
									oModel.setRefreshAfterChange(true);
								}
							}
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
				success: () => {
					oView.setBusy(false);
					//Only when actually setting a value (not when toggling a selection off)
					if (sNewValue) {
						MessageToast.show(this.getI18nText("resultRecorded"));
					}
				},
				error: () => oView.setBusy(false)
			});
		},

		/**
		 * Liefert den OK-Code ("Ja") des Merkmals aus dessen Auswahlmenge.
		 * Kommt als Property OkCode vom Backend (Code mit Bewertung 'A' aus QPAC).
		 * Fallbacks: Charakteristik-Entität (für single_result-Zeilen), dann der
		 * bisherige feste i18n-Code (J), solange das Backend OkCode nicht liefert.
		 */
		_getOkCode: function (oCtx) {
			let sOkCode = oCtx.getProperty("OkCode");
			if (!sOkCode) {
				sOkCode = this.getView().getModel().getProperty(this._getCharacteristicPath(oCtx) + "/OkCode");
			}
			return sOkCode || this.getView().getModel("i18n").getResourceBundle().getText("XOK");
		},

		onSelectYes: function (oEvent) {
			const oCtx = oEvent.getSource().getBindingContext();
			const sXOK = this._getOkCode(oCtx);
			const sCurrent = oCtx.getObject().Code1;

			//Toggle: deselect if already YES, otherwise set to YES
			const sValue = sCurrent === sXOK ? "" : sXOK;
			this._setEvaluationCode(oCtx, sValue);
		},

		onSelectNo: function (oEvent) {
			const oCtx = oEvent.getSource().getBindingContext();
			const sXOK = this._getOkCode(oCtx);
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

				//Wenn der Fehlerkatalog genau einen Eintrag enthält, diesen direkt vorbelegen
				//(wie in QE51N). toDefectCodes wird asynchron geladen -> auf dataReceived warten.
				const oComboBox = oDialog.getContent()[0].getItems()[1];
				const oItemsBinding = oComboBox.getBinding("items");
				if (oItemsBinding) {
					oItemsBinding.attachEventOnce("dataReceived", () => this._preselectSingleDefectCode(oComboBox, oDialog));
				}

				oDialog.open();
			});
		},

		/**
		 * Belegt die Fehlerart-ComboBox automatisch vor, wenn der Katalog genau einen Eintrag hat.
		 * Der einzelne Code wird zusätzlich am Dialog gemerkt, damit er auch bei Abbruch gilt.
		 * @param {sap.m.ComboBox} oComboBox Die Fehlerart-ComboBox
		 * @param {sap.m.Dialog} oDialog Der Fehlerart-Dialog
		 */
		_preselectSingleDefectCode: function (oComboBox, oDialog) {
			const aItems = oComboBox.getItems();
			if (aItems.length === 1) {
				oComboBox.setSelectedItem(aItems[0]);
				oDialog._sSingleDefectCode = aItems[0].getKey();
			}
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
			const oDialog = oEvent.getSource().getParent();
			const oTargetCtx = oDialog._oTargetCtx;

			if (oTargetCtx && oDialog._sSingleDefectCode) {
				//Genau ein Katalog-Code: Abbruch trotzdem als "Nein" mit diesem Code werten
				//(entspricht dem bisherigen Verhalten bei J/N-Auswahlmengen). Sonst bliebe
				//ein zuvor gesetztes "Ja" stehen und beide Haken wären optisch gesetzt.
				this._setEvaluationCode(oTargetCtx, oDialog._sSingleDefectCode);
			} else {
				//Mehrere Codes: Fehlerart nicht ratbar -> Modell unverändert lassen und nur
				//die durch den Klick optisch gesetzte Nein-Checkbox auf den Modellstand zurücksetzen
				this.getView().getModel().checkUpdate(true);
			}
			oDialog.destroy();
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
			const sXOK = this._getOkCode(oCtx);
			const sCurrent = oCtx.getObject().Code1;

			//Toggle: deselect wenn bereits Yes, sonst auf Yes setzen
			const sValue = sCurrent === sXOK ? "" : sXOK;
			this._setEvaluationCode(oCtx, sValue);
		},

		onSelectNoSingleResult: function (oEvent) {
			const oCtx = oEvent.getSource().getBindingContext();
			const sXOK = this._getOkCode(oCtx);
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

			//Fresh field model on each open; Prüfer defaults to the current user
			this.getView().setModel(new JSONModel({
				operation:  "",
				pruefer:    this._getCurrentUser(),
				maschine:   "",
				nestnummer: "1",
				usern2:     "002"   // Default: Serienprüfung
			}), "newIP");

			//Recently entered Prüfer values (browser-local) as type-ahead suggestions
			this.getView().setModel(new JSONModel({ recent: this._loadPrueferHistory() }), "prueferHist");

			Fragment.load({
				name: "de.mindsquare.InspectionQM.view.fragments.DialogNewInspPoint",
				controller: this
			}).then((oDialog) => {
				this._oNewIPDialog = oDialog;
				this.getView().addDependent(oDialog);
				oDialog.setBindingContext(oCtx);

				//Vorgang vorbelegen, wenn das Prüflos genau einen relevanten (QM92-)Vorgang hat.
				//toOperationsWithInspPoints lädt asynchron (dataReceived) bzw. kommt aus dem
				//Client-Cache (nur change) -> beide Events abdecken, Vorbelegung ist idempotent.
				const oOperationSelect = oDialog.getContent()[0].getContent()[1];
				const oItemsBinding = oOperationSelect.getBinding("items");
				if (oItemsBinding) {
					oItemsBinding.attachEventOnce("dataReceived", () => this._preselectSingleOperation(oOperationSelect));
					oItemsBinding.attachEventOnce("change", () => this._preselectSingleOperation(oOperationSelect));
				}

				oDialog.open();
			});
		},

		/**
		 * Belegt den Vorgang im Anlege-Dialog vor, wenn genau ein relevanter Vorgang existiert.
		 * @param {sap.m.Select} oSelect Das Vorgangs-Select des Anlege-Dialogs
		 */
		_preselectSingleOperation: function (oSelect) {
			const aItems = oSelect.getItems();
			if (aItems.length === 1) {
				this.getView().getModel("newIP").setProperty("/operation", aItems[0].getKey());
			}
		},

		//--- Prüfer history (browser localStorage) -------------------------------------------------
		_PRUEFER_STORAGE_KEY: "de.mindsquare.InspectionQM.prueferRecent",

		_loadPrueferHistory: function () {
			try {
				const sRaw = window.localStorage.getItem(this._PRUEFER_STORAGE_KEY);
				const aValues = sRaw ? JSON.parse(sRaw) : [];
				return Array.isArray(aValues) ? aValues.map((sValue) => ({ value: sValue })) : [];
			} catch (e) {
				return [];
			}
		},

		_savePrueferHistory: function (sValue) {
			if (!sValue) {
				return;
			}
			try {
				const sRaw = window.localStorage.getItem(this._PRUEFER_STORAGE_KEY);
				let aValues = sRaw ? JSON.parse(sRaw) : [];
				if (!Array.isArray(aValues)) {
					aValues = [];
				}
				//Most-recent first, no duplicates, keep last 10
				aValues = aValues.filter((sEntry) => sEntry !== sValue);
				aValues.unshift(sValue);
				aValues = aValues.slice(0, 10);
				window.localStorage.setItem(this._PRUEFER_STORAGE_KEY, JSON.stringify(aValues));
			} catch (e) {
				//ignore storage errors (e.g. private mode)
			}
		},

		//Best-effort current user for the Prüfer default (FLP if available, otherwise empty -> backend defaults to sy-uname)
		_getCurrentUser: function () {
			try {
				if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getUser) {
					return sap.ushell.Container.getUser().getId();
				}
			} catch (e) {
				//ignore - no shell available
			}
			return "";
		},

		//F4 for Maschine: fetch the QE51N value list via the MachineF4 function import (filtered by the lot's plant)
		onMachineValueHelp: function () {
			const oCtx = this.getView().getBindingContext();
			const sWerks = oCtx ? oCtx.getObject().Werks : "";
			const oModel = this.getView().getModel();

			oModel.callFunction("/MachineF4", {
				method: "GET",
				urlParameters: { Werks: sWerks },
				success: (oData) => {
					const aResults = (oData && oData.results) ? oData.results : [];
					const aItems = aResults.map((oEntry) => ({ code: oEntry.Code, description: oEntry.Description }));
					const oMachines = new JSONModel({ items: aItems });

					Fragment.load({
						name: "de.mindsquare.InspectionQM.view.fragments.MachineValueHelp",
						controller: this
					}).then((oDialog) => {
						this._oMachineDialog = oDialog;
						this.getView().addDependent(oDialog);
						oDialog.setModel(oMachines, "Machines");
						oDialog.open();
					});
				},
				error: () => {
					//Detailed error message comes via the central ErrorHandling.js
				}
			});
		},

		onMachineSearch: function (oEvent) {
			const sValue = oEvent.getParameter("value") || "";
			const oBinding = oEvent.getSource().getBinding("items");
			if (!oBinding) {
				return;
			}
			if (sValue) {
				oBinding.filter([new Filter({
					filters: [
						new Filter("code", FilterOperator.Contains, sValue),
						new Filter("description", FilterOperator.Contains, sValue)
					],
					and: false
				})]);
			} else {
				oBinding.filter([]);
			}
		},

		onMachineConfirm: function (oEvent) {
			const aContexts = oEvent.getParameter("selectedContexts") || [];
			if (aContexts.length > 0) {
				this.getView().getModel("newIP").setProperty("/maschine", aContexts[0].getObject().code);
			}
			this._destroyMachineDialog();
		},

		onMachineCancel: function () {
			this._destroyMachineDialog();
		},

		_destroyMachineDialog: function () {
			if (this._oMachineDialog) {
				this._oMachineDialog.destroy();
				this._oMachineDialog = null;
			}
		},

		onPressDialogNewInspPointClose: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onPressDialogNewInspPointConfirm: function (oEvent) {
			const oDialog = oEvent.getSource().getParent();
			const oModel = this.getView().getModel();
			const oCtx = this.getView().getBindingContext();
			const oNewIP = this.getView().getModel("newIP");

			const sOperation  = oNewIP.getProperty("/operation");
			const sPruefer    = oNewIP.getProperty("/pruefer");
			const sMaschine   = oNewIP.getProperty("/maschine");
			const sNestnummer = oNewIP.getProperty("/nestnummer");
			const sUsern2     = oNewIP.getProperty("/usern2");

			//All fields are mandatory
			if (!sOperation || !sPruefer || !sMaschine || !sNestnummer || !sUsern2) {
				MessageToast.show(this.getI18nText("allFieldsRequired"));
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
					Usern2: sUsern2,
					Userc1: sPruefer,
					Userc2: sMaschine,
					Usern1: sNestnummer
				},
				success: (oResult, oResponse) => {
					oDialog.setBusy(false);
					oDialog.close();
					//Remember the entered Prüfer for next time (browser-local suggestions)
					this._savePrueferHistory(sPruefer);
					//Success text (incl. the new inspection point number) is owned by the backend
					//and delivered via the sap-message response header; fall back to the static text.
					let sMsg;
					const sHeader = oResponse && oResponse.headers &&
						(oResponse.headers["sap-message"] || oResponse.headers["Sap-Message"] || oResponse.headers["SAP-Message"]);
					if (sHeader) {
						try {
							sMsg = JSON.parse(sHeader).message;
						} catch (e) {
							//Ignore a malformed sap-message header
						}
					}
					MessageToast.show(sMsg || this.getI18nText("inspPointCreated"));
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
			//bShowMessage = true: only the operation lock shows the success toast, not the per-characteristic buttons
			this.callCloseChar(" ", oCtx, false, true);
		},

		callCloseChar: function (type, ctx, bSendChar = true, bShowMessage = false) {
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
				urlParameters: oData,
				//Success message text is owned by the backend and delivered via the sap-message response header.
				//Errors are surfaced through the ODataModel's standard MessageManager channel - no custom handling here.
				success: (oResult, oResponse) => {
					if (!bShowMessage) {
						return;
					}
					const sHeader = oResponse && oResponse.headers &&
						(oResponse.headers["sap-message"] || oResponse.headers["Sap-Message"] || oResponse.headers["SAP-Message"]);
					if (!sHeader) {
						return;
					}
					try {
						const oMsg = JSON.parse(sHeader);
						if (oMsg && oMsg.message) {
							MessageToast.show(oMsg.message);
						}
					} catch (e) {
						//Ignore a malformed sap-message header - no toast in that case
					}
				}
			});
		},

		//Default state of the history tab: all operations collapsed (runs on every list refresh)
		onHistoryListUpdateFinished: function () {
			this._setPanelsExpanded("idMainList", false);
		},

		onExpandAllHistory: function () {
			this._setPanelsExpanded("idMainList", true);
		},

		onCollapseAllHistory: function () {
			this._setPanelsExpanded("idMainList", false);
		},

		onExpandAllOperations: function () {
			this._setPanelsExpanded("idOperationsList", true);
		},

		onCollapseAllOperations: function () {
			this._setPanelsExpanded("idOperationsList", false);
		},

		//Expand/collapse every operation panel in the given list.
		//Each list item is a CustomListItem whose first content control is the Panel.
		_setPanelsExpanded: function (sListId, bExpand) {
			const oList = this.getView().byId(sListId);
			if (!oList) {
				return;
			}
			oList.getItems().forEach((oItem) => {
				if (!oItem.getContent) {
					return;
				}
				const oPanel = oItem.getContent()[0];
				if (oPanel && oPanel.setExpanded) {
					oPanel.setExpanded(bExpand);
				}
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

		onTabSelect: function (oEvent) {
			if (oEvent.getParameter("key") !== "attachments") {
				return;
			}
			//Anhänge werden bereits mit dem Prüflos geladen. Beim ersten Öffnen des Tabs
			//den Hinweis-Strip an die Attachment-Bindung koppeln und sofort neu bewerten
			//(der Ladevorgang ist da meist schon durch).
			const oBinding = this.byId("idAttachments").getBinding("items");
			if (oBinding && !this._bAttachMsgHookAttached) {
				oBinding.attachDataRequested(this._clearAttachmentMessage, this);
				oBinding.attachDataReceived(this._refreshAttachmentMessage, this);
				this._bAttachMsgHookAttached = true;
			}
			this._refreshAttachmentMessage();
		},

		//Vor dem (Neu-)Laden der Anhänge alte Dokument-Meldungen entfernen, damit kein
		//Hinweis aus einem vorher geöffneten Prüflos hängen bleibt.
		_clearAttachmentMessage: function () {
			const oMM = sap.ui.getCore().getMessageManager();
			const aDoc = (oMM.getMessageModel().getData() || []).filter((m) =>
				/dokument|document/i.test(this._msgText(m)));
			if (aDoc.length) {
				oMM.removeMessages(aDoc);
			}
			const oUi = this.getView().getModel("ui");
			oUi.setProperty("/attachMsg", false);
			oUi.setProperty("/attachMsgText", "");
		},

		//Zeigt Warn-/Fehlermeldungen aus dem sap-message-Header der Attachment-Ladung
		//(z.B. "nicht berechtigt für Dokumentart C95") als Strip im Anhänge-Tab.
		_refreshAttachmentMessage: function () {
			const aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getData() || [];
			const aDocMsg = aMessages.filter((m) => {
				const sType = m.getType ? m.getType() : m.type;
				return (sType === "Warning" || sType === "Error") && /dokument|document/i.test(this._msgText(m));
			});
			const oUi = this.getView().getModel("ui");
			if (aDocMsg.length) {
				oUi.setProperty("/attachMsgText", aDocMsg.map((m) => this._msgText(m)).join("\n"));
				oUi.setProperty("/attachMsg", true);
			} else {
				oUi.setProperty("/attachMsg", false);
				oUi.setProperty("/attachMsgText", "");
			}
		},

		//Message-Text robust lesen (Message-Objekt vs. einfaches Datenobjekt)
		_msgText: function (oMessage) {
			return (oMessage.getMessage ? oMessage.getMessage() : oMessage.message) || "";
		},

		onOpenAttachment: function (oEvent) {
			//Standard-Download verhindern und Datei im neuen Tab öffnen
			oEvent.preventDefault();
			const oItem = oEvent.getParameter("item");
			const sUrl = oItem && oItem.getUrl();
			if (sUrl) {
				window.open(sUrl, "_blank", "noopener,noreferrer");
			}
		},

		onAfterItemRemoved: function (oEvent) {
			const oItem = oEvent.getParameter("item");
			const oCtx = oItem.getBindingContext();
			const oModel = this.getView().getModel();
			const sPath = "/" + oModel.createKey("InspectionLotAttachmentSet", {
				InspectionLot: oCtx.getObject().InspectionLot,
				AttachmentId: oCtx.getObject().AttachmentId
			});

			const oUploadSet = oItem.getParent();

			oModel.remove(sPath, {
				refreshAfterChange: false,   // kein Auto-Refresh -> wir steuern den Refresh manuell
				success: () => {
					//Erst nach dem nächsten Event-Tick refreshen, damit alte UI-Items zerstört sind
					setTimeout(() => {
						const oBinding = oUploadSet ? oUploadSet.getBinding("items") : null;
						if (oBinding) {
							oBinding.refresh(true);
						}
					}, 0);
				},
				error: () => {
					//Backend hat abgelehnt -> Liste wieder herstellen
					setTimeout(() => {
						const oBinding = oUploadSet ? oUploadSet.getBinding("items") : null;
						if (oBinding) {
							oBinding.refresh(true);
						}
					}, 0);
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
		 * Title formatter for the read-only operations overview tab.
		 * Shows operation, work center and control key only - no recording timestamp or sample,
		 * since this tab is a plain overview of which operations exist for the inspection lot.
		 */
		formatOperationOverviewTitle: function (sOperation, sOperationText, sWorkcenter, sWorkcenterText, sControlKey) {
			let sTitle = this.getI18nText("operation") + " " + sOperation + " " + sOperationText;

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
		 * Returns true if the value violates one of the present tolerance limits.
		 * Each limit is checked independently, so it also works when only one limit is set:
		 *  - only lower limit: value below the lower limit is out of tolerance
		 *  - only upper limit: value above the upper limit is out of tolerance
		 *  - both limits: value outside [lower, upper]
		 * A missing limit yields NaN via _parseNumber and is simply skipped.
		 * @private
		 */
		_isOutsideTolerance: function (sValue, sLowerLimit, sUpperLimit) {
			if (!sValue) {
				return false;
			}
			const fValue = this._parseNumber(sValue);
			if (isNaN(fValue)) {
				return false;
			}

			const fLower = this._parseNumber(sLowerLimit);
			if (!isNaN(fLower) && fValue < fLower) {
				return true;
			}

			const fUpper = this._parseNumber(sUpperLimit);
			if (!isNaN(fUpper) && fValue > fUpper) {
				return true;
			}

			return false;
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
				let sDetails = "";

				if (sTargetValue) {
					sDetails = this.getI18nText("target") + ": " + sTargetValue;

					if (sUnitText) {
						sDetails = sDetails + " " + sUnitText;
					}

					if (sLowerLimit && sUpperLimit) {
						sDetails = sDetails + ", " + this.getI18nText("tolerance") + ": " +
							sLowerLimit + " - " + sUpperLimit;
					} else if (sLowerLimit) {
						sDetails = sDetails + ", " + this.getI18nText("lowerLimit") + ": " + sLowerLimit;
					} else if (sUpperLimit) {
						sDetails = sDetails + ", " + this.getI18nText("upperLimit") + ": " + sUpperLimit;
					}
				} else if (sLowerLimit && sUpperLimit) {
					sDetails = this.getI18nText("tolerance") + ": " +
						sLowerLimit + " - " + sUpperLimit;

					if (sUnitText) {
						sDetails = sDetails + " " + sUnitText;
					}
				} else if (sLowerLimit) {
					sDetails = this.getI18nText("lowerLimit") + ": " + sLowerLimit;

					if (sUnitText) {
						sDetails = sDetails + " " + sUnitText;
					}
				} else if (sUpperLimit) {
					sDetails = this.getI18nText("upperLimit") + ": " + sUpperLimit;

					if (sUnitText) {
						sDetails = sDetails + " " + sUnitText;
					}
				}

				if (sDetails) {
					sTitle = sTitle + " (" + sDetails + ")";
				}
			}

			return sTitle;
		}

	});

});
