sap.ui.define([
	"de/mindsquare/InspectionQM/controller/BaseController",
	"sap/ui/Device"
], function (Controller, Device) {
	"use strict";

	return Controller.extend("de.mindsquare.InspectionQM.controller.App", {

		onInit: function () {

		},

		//HideMode: Das Detail läuft immer im Vollbild. Beim App-Start wird die
		//Prüflosliste einmalig als Overlay eingeblendet, damit der Einstieg wie
		//gewohnt in der Liste beginnt. (Auf dem Phone ist die Master-Page ohnehin
		//die Startseite des NavContainers.)
		onAfterRendering: function () {
			if (!Device.system.phone && !this._bMasterShownOnStart) {
				this._bMasterShownOnStart = true;
				this.byId("splitApp").showMaster();
			}
		}

	});
});
