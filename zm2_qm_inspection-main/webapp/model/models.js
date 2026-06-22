sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device"
], function (JSONModel, Device) {
	"use strict";

	return {

		createDeviceModel: function () {
			//Wir spiegeln Device.system und Device.orientation als Objekt-Refs in einem JSONModel,
			//zusaetzlich legen wir /range als Top-Level-Property an. Device.media.Std existiert NICHT
			//direkt - der aktuelle Range muss via Device.media.getCurrentRange("Std") geholt und in
			///range geschrieben werden, damit Bindings darauf zuverlaessig auswerten.
			const oModel = new JSONModel({
				system: Device.system,
				orientation: Device.orientation,
				range: ""
			});
			oModel.setDefaultBindingMode("OneWay");

			const updateRange = function () {
				const oRange = Device.media.getCurrentRange(Device.media.RANGESETS.SAP_STANDARD);
				oModel.setProperty("/range", oRange ? oRange.name : "");
			};
			updateRange();
			Device.media.attachHandler(updateRange);

			//Orientation-Wechsel (Portrait/Landscape) triggert keine Media-Range-Aenderung,
			//muss aber Bindings auf device>/orientation/portrait neu evaluieren lassen.
			Device.orientation.attachHandler(function () {
				oModel.checkUpdate();
			});

			return oModel;
		}

	};
});
