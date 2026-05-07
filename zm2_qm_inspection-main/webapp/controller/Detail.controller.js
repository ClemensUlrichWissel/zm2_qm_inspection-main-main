sap.ui.define([
	"de/mindsquare/InspectionQM/controller/BaseController",
	"sap/ui/core/Fragment"
], function (Controller, Fragment) {
	"use strict";

	return Controller.extend("de.mindsquare.InspectionQM.controller.Detail", {

		onInit: function () {
			this.getRouter().getRoute("InspectionLotDetail").attachMatched(this._onRouteMatched, this);
		},
		
		_onRouteMatched: function (oEvent) {
			var sLotNumber = oEvent.getParameter("arguments").LotNumber;
			this.getView().getModel().metadataLoaded().then(function () {
				var sPath = "/" + this.getView().getModel().createKey("InspectionLotSet", {
					InspectionLotNumber: sLotNumber
				})
				this.getView().bindElement(sPath);
				//TS, 10.06.2022, Refresh model to update flags like HasUsageDecision in case inspection lots get opened multiple times
				//this.getView().getModel().refresh(); //Refreshes thw whole model including the entries in the master list
				this.getView().getElementBinding().refresh(); //Refreshes only the details view
			}.bind(this));
		},
		
		onAfterRendering: function() {
			//Main method to save everything (what is changed - immediately goes for saving)
			this.getView().getModel().metadataLoaded().then(function () {
				this.getView().setBusyIndicatorDelay(0);
				
				this.getView().getModel().attachPropertyChange(function() {
					this.getView().setBusy(true);
					this.getView().getModel().submitChanges({
						success: function() {
							this.getView().setBusy(false);
						}.bind(this),
						error: function() {
							this.getView().setBusy(false);
						}.bind(this)
					});
				}.bind(this));
			}.bind(this));
		},
		
		// onRadioSelect: function (oEvent) {
		// 	var iSelected = oEvent.getParameter("selectedIndex");
		// 	var oModel = this.getView().getModel();
		// 	var oCtx = oEvent.getSource().getBindingContext();
		// 	var oResBundle = this.getView().getModel("i18n").getResourceBundle();
			
		// 	//used i18n translations for XOK and XNOK for usage in target system
		// 	oModel.setProperty(oCtx.getPath() + "/Code1", iSelected === 0 ? oResBundle.getText("XOK") : oResBundle.getText("XNOK"));
		// 	this.getView().setBusy(true);
		// 	oModel.submitChanges({
		// 		success: function() {
		// 			this.getView().setBusy(false);
		// 		}.bind(this),
		// 		error: function() {
		// 			this.getView().setBusy(false);
		// 		}.bind(this)
		// 	});
		// },
		
		onSelectYes: function (oEvent) {
			var oModel = this.getView().getModel();
			var oCtx = oEvent.getSource().getBindingContext();
			var oResBundle = this.getView().getModel("i18n").getResourceBundle();
			var sValue;
			
			if (oCtx.getObject().Code1 === oResBundle.getText("XOK")) {
				//This is a deselect
				sValue = "";
			} else if (oCtx.getObject().Code1 === oResBundle.getText("XNOK")) {
				//This is a change
				sValue = oResBundle.getText("XOK");
			} else {
				//No value was set before
				sValue = oResBundle.getText("XOK");
			}
			
			//used i18n translations for XOK and XNOK for usage in target system
			oModel.setProperty(oCtx.getPath() + "/Code1", sValue);
			this.getView().setBusy(true);
			oModel.submitChanges({
				success: function() {
					this.getView().setBusy(false);
				}.bind(this),
				error: function() {
					this.getView().setBusy(false);
				}.bind(this)
			});
		},
		
		onSelectNo: function (oEvent) {
			var oModel = this.getView().getModel();
			var oCtx = oEvent.getSource().getBindingContext();
			var oResBundle = this.getView().getModel("i18n").getResourceBundle();
			var sValue;
			
			if (oCtx.getObject().Code1 === oResBundle.getText("XNOK")) {
				//This is a deselect
				sValue = "";
			} else if (oCtx.getObject().Code1 === oResBundle.getText("XOK")) {
				//This is a change
				sValue = oResBundle.getText("XNOK");
			} else {
				//No value was set before
				sValue = oResBundle.getText("XNOK");
			}
			
			//used i18n translations for XOK and XNOK for usage in target system
			oModel.setProperty(oCtx.getPath() + "/Code1", sValue);
			this.getView().setBusy(true);
			oModel.submitChanges({
				success: function() {
					this.getView().setBusy(false);
				}.bind(this),
				error: function() {
					this.getView().setBusy(false);
				}.bind(this)
			});
		},
		
		onPressCharacteristic: function (oEvent) {
			var oPopover = new sap.m.Popover({
				placement: "PreferredBottomOrFlip",
				title: this.getI18nText("longtext"),
				titleAlignment: "Center",
				content: [
					new sap.m.TextArea({
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
			var oCtx = oEvent.getSource().getBindingContext();
			
			Fragment.load({
				name: "de.mindsquare.InspectionQM.view.fragments.DialogSingleResults",
				controller: this
			}).then(function (oDialog) {
				this.getView().addDependent(oDialog);
				oDialog.setBindingContext(oCtx);
				oDialog.open();
			}.bind(this));
		},
		
		onCloseSingleResults: function (oEvent) {
			oEvent.getSource().getParent().close();
		},
		
		onPressComment: function (oEvent) {
			var oCtx = oEvent.getSource().getBindingContext();
			
			Fragment.load({
				name: "de.mindsquare.InspectionQM.view.fragments.DialogComment",
				controller: this
			}).then(function (oDialog) {
				this.getView().addDependent(oDialog);
				oDialog.getContent()[0].setValue(oCtx.getProperty("CharComment"));
				oDialog._oCtx = oCtx;
				oDialog.open();
			}.bind(this));
		},
		
		onAcceptComment: function (oEvent) {
			var oDialog = oEvent.getSource().getParent();
			var sPath = oDialog._oCtx.getPath();
			
			oDialog.getModel().setProperty(sPath + "/CharComment", oDialog.getContent()[0].getValue());
			oDialog.getModel().submitChanges();
			oDialog.close();
		},
		
		onCancelComment: function (oEvent) {
			oEvent.getSource().getParent().close();
		},
		
		onAddNewSample: function (oEvent) {
			var oCtx = this.getView().getBindingContext();
			
			Fragment.load({
				name: "de.mindsquare.InspectionQM.view.fragments.DialogNewSample",
				controller: this
			}).then(function (oDialog) {
				this.getView().addDependent(oDialog);
				oDialog.setBindingContext(oCtx);
				oDialog.open();
			}.bind(this));
		},
		
		onPressDialogNewSampleClose: function (oEvent) {
			oEvent.getSource().getParent().close();
		},
		
		onPressDialogNewSampleConfirm: function (oEvent) {
			var oSimpleForm = oEvent.getSource().getParent().getContent()[0];
			var oSelect = oSimpleForm.getContent()[1];
			var sOperation = oSelect.getSelectedKey();
			var oModel = this.getView().getModel();
			var oCtx = this.getView().getBindingContext();
			var oDialog = oEvent.getSource().getParent();
			
			oModel.callFunction("/CreateNewSample", {
				refreshAfterChange: true,
				method: "POST",
				urlParameters: {
					InspectionLot: oCtx.getObject().InspectionLotNumber,
					InspLotAction: sOperation
				},
				success: function (oData, oResponse) {
					oDialog.close();
				}.bind(this),
				error: function (oError) {
					//TODO
				}.bind(this)
			})
		},
		
		onUsageDecision: function () {
			var oCtx = this.getView().getBindingContext();
			var oModel = new sap.ui.model.json.JSONModel();
			var oList = this.getView().byId("idMainList");
			var that = this;
			var bOpened = false;
			
			oList.getItems().forEach(function(item){
				item.getContent()[0].getItems()[1].getItems().forEach(function(child){
					var bClosed = child.getContent()[0].getBindingContext().getProperty("Closed");
					var bObligatory = child.getContent()[0].getBindingContext().getProperty("Obligatory");
					
					if(!bClosed && bObligatory) bOpened = true;
				});
			});
			
			var openDialog = function () {
				//All the values for decision is kept in another model cause it will be saved to FI
				oModel.setProperty("/DefaultStorageLoc", oCtx.getProperty("DefaultStorageLoc"));
				oModel.setProperty("/IsStockRelevant", oCtx.getProperty("IsStockRelevant"));
				oModel.setProperty("/InspectionLot", oCtx.getProperty("InspectionLotNumber"));
				oModel.setProperty("/Comment", "");
				oModel.setProperty("/Decision", "");
				
				Fragment.load({
					name: "de.mindsquare.InspectionQM.view.fragments.DialogUsageDecision",
					controller: that
				}).then(function (oDialog) {
					this.getView().addDependent(oDialog);
					oDialog.setModel(oModel, "DecisionModel");
					oDialog.open();
				}.bind(that));
			}
			
			if(bOpened){
				sap.m.MessageBox.warning(this.getView().getModel("i18n").getResourceBundle().getText("still-opened"), {
					actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
					emphasizedAction: sap.m.MessageBox.Action.OK,
					onClose: function (sAction) {
						if(sAction === "OK") openDialog();
					}
				});
			} else {
				openDialog();
			}
		},
		
		onAcceptDecision: function (oEvent) {
			var oDialog = oEvent.getSource().getParent();
			var oModel = oDialog.getModel("DecisionModel");
			var oDataModel = this.getView().getModel();
			
			oDialog.setBusyIndicatorDelay(0);
			oDialog.setBusy(true);
			
			if(oModel.getProperty("/IsStockRelevant") && !oModel.getProperty("/DefaultStorageLoc")){
				sap.m.MessageToast(this.getView().getModel("i18n").getResourceBundle().getText("funcloc-required"));
				return;
			}
			var oData = {
				InspectionLot: oModel.getProperty("/InspectionLot"),
				UsageDecisionKey: oModel.getProperty("/Decision"),
				StorageLocation: oModel.getProperty("/DefaultStorageLoc"),
				Comment: oModel.getProperty("/Comment")
			};
			
			oDataModel.callFunction("/PostUsageDecision", {
				refreshAfterChange: true,
				method: "POST",
				urlParameters: oData,
				success: function (oData, oResponse) {
					oDialog.setBusy(false);
					oDialog.close();
					this.getView().unbindElement();
					//TS, 10.06.2022, Also navigate to allow re-opening of inspection lot with long term characteristics
					this.getRouter().navTo("RouteMain", {}, true);
				}.bind(this),
				error: function (oError) {
					oDialog.setBusy(false);
				}.bind(this)
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
			//Don't send a characteristic ID to the backend therefore - the backend will then close all characteristics for the given operation
			//Navigation: Button (Source) --> Inner HBox (Parent 1) --> Outer HBox (Parent 2) --> VBox (Parent 3) --> List (Item with Index 1 in VBox)
			let oList = oEvent.getSource().getParent().getParent().getParent().getItems()[1];
			let aItems = oList.getItems();
			
			if (aItems.length === 0) {
				//Nothing to close
				return;
			}
			
			let oItem = aItems[0];
			let oCtx = oItem.getBindingContext();
			this.callCloseChar(" ", oCtx, false);
		},
		
		callCloseChar: function(type, ctx, bSendChar = true) {
			var oModel = this.getView().getModel();
			var oData = {
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
			var oUploadSet = oEvent.getSource();
			var sCsrfToken = this.getView().getModel().getSecurityToken();
			var oCtx = this.getView().getBindingContext();
			var sSlug = oCtx.getObject().InspectionLotNumber + "|" + oEvent.getParameter("item").getProperty("fileName");
			
			this._addUploadHeaderField("x-csrf-token", sCsrfToken, oUploadSet);
			this._addUploadHeaderField("slug", sSlug, oUploadSet);
		},
		
		_addUploadHeaderField: function (sHeaderName, sValue, oUploadSet) {
			var bHeaderFound = false;
			var aHeaderFIelds = oUploadSet.getHeaderFields();
			
			aHeaderFIelds.forEach(oHeaderField => {
				if (oHeaderField.getKey() === sHeaderName) {
					bHeaderFound = true;
					oHeaderField.setText(sValue);
				}
			});
			
			if (!bHeaderFound) {
				oUploadSet.addHeaderField(
					new sap.ui.core.Item({
						key: sHeaderName,
						text: sValue
					})
				);
			}
		},
		
		onUploadCompleted: function (oEvent) {
			oEvent.getSource().removeAllIncompleteItems();
			oEvent.getSource().getBinding("items").refresh();
		},
		
		onAfterItemRemoved: function (oEvent) {
			var oCtx = oEvent.getParameter("item").getBindingContext();
			var oModel = this.getView().getModel();
			var sPath = "/" + oModel.createKey("InspectionLotAttachmentSet", {
				InspectionLot: oCtx.getObject().InspectionLot,
				AttachmentId: oCtx.getObject().AttachmentId
			});
			
			//We need to store the reference to the deleted item because for some reason, the UploadSet does 
			//not destroy the item after deletion
			this._oItemDeleted = oEvent.getParameter("item");
			
			oModel.remove(sPath, {
				success: function (oData, oResponse) {
					//Destroy the item to prevent duplicated ID errors
					this._oItemDeleted.destroy();
				}.bind(this),
				error: function (oError) {
					//TODO
				}.bind(this)
			});
		},
		
		formatOperationTitle: function (sOperation, sOperationText, sWorkcenter, sWorkcenterText, sControlKey, sUsern1,
			sPhysSample, dUserDate, dUserTime) {
			var sTitle = this.getI18nText("operation") + " " + sOperation + " " + sOperationText;
			
			if (sPhysSample || (dUserDate && dUserTime)) {
				//Staedtler test cases
				if (sPhysSample) {
					sTitle = sTitle + " | " + this.getI18nText("sample") + " " + sPhysSample;
				}
				
				if (dUserDate && dUserTime) {
					sTitle = sTitle + " | " + sap.ui.core.format.DateFormat.getDateInstance().format(dUserDate) +
						" / " + sap.ui.core.format.DateFormat.getTimeInstance().format(new Date(dUserTime.ms), true);
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
		
		formatCharacteristicTitle: function (sCharateristic, sMasterCharacteristic, sCharacteristicText,
			sTargetValue, sUpperLimit, sLowerLimit, sChararcteristicType, sUnitText, sScope) {
			var sTitle = sCharateristic;
			
			if (sMasterCharacteristic) {
				sTitle = sTitle + " | " + sMasterCharacteristic;
			} else {
				sTitle = sTitle + " | -";
			}
			
			sTitle = sTitle + " | " + sCharacteristicText;
			
			if (parseInt(sScope, 10) > 1) {
				sTitle = sTitle + " | " + this.getI18nText("scope") + ": " + parseInt(sScope, 10);
			}
			
			if (sChararcteristicType === "01") {
				//Quantitative characteristic - add target value and limits
				if (sTargetValue) {
					sTitle = sTitle + " (" + this.getI18nText("target") + ": " + sTargetValue;
					
					if (sUnitText) {
						//Add unit if available
						sTitle = sTitle + " " + sUnitText 
					}
					
					if (sLowerLimit && sUpperLimit) {
						sTitle = sTitle + ", " + this.getI18nText("tolerance") + ": " + 
							sLowerLimit + " - " + sUpperLimit + ")";
					}
				} else if (sLowerLimit && sUpperLimit) {
					sTitle = sTitle + " (" + this.getI18nText("tolerance") + ": " + 
						sLowerLimit + " - " + sUpperLimit;
					
					if (sUnitText) {
						//Add unit if available
						sTitle = sTitle + " " + sUnitText 
					}
					
					sTitle = sTitle + ")";
				}
				
				
			}
			
			return sTitle;
		}

	});

});