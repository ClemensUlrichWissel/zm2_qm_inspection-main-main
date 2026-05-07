// This class provides a static error-handling facility. Its only method (register) is called during application startup.
// Suitable error handlers are attached to the OData model of this app.

sap.ui.define([
    "sap/m/MessageBox"
], function (MessageBox) {
    "use strict";

    function fnShowMetadataError(oParams, oErrorTexts, oDisplayState, oModel) {
        oDisplayState.bMessageOpen = true;
        MessageBox.error(
            oErrorTexts.sErrorText, {
            title: oErrorTexts.sErrorTitle,
            details: oErrorTexts.details || oParams.response,
            actions: [MessageBox.Action.RETRY, MessageBox.Action.CLOSE],
            onClose: function (sAction) {
                oDisplayState.bMessageOpen = false;
                if (sAction === MessageBox.Action.RETRY) {
                    oModel.refreshMetadata();
                }
            }
        }
        );
    }

    function fnShowServiceError(oParams, oErrorTexts, oDisplayState) {
        if (!oDisplayState.bMessageOpen) {
            oDisplayState.bMessageOpen = true;
            MessageBox.show(
                oErrorTexts.sErrorText + "\n\nDetails:\n" + (oErrorTexts.details || oParams.response), {
                    icon: MessageBox.Icon.ERROR,
                    title: oErrorTexts.sErrorTitle,
                    actions: [MessageBox.Action.CLOSE],
                    onClose: function () {
                        oDisplayState.bMessageOpen = false;
                    }
                }
            );
        }
    }

    return {
        register: function (oComponent) {
            var oResourceBundle = oComponent.getModel("i18n").getResourceBundle(),
                oErrorTexts = {
                    sErrorText: oResourceBundle.getText("errorText"),
                    sErrorTitle: oResourceBundle.getText("errorTitle")
                },
                oDisplayState = {
                    bMessageOpen: false
                };

            var oManifestModels = oComponent.getManifestEntry("sap.ui5").models || {};

            for (var sModel in oManifestModels) {
                if (oManifestModels[sModel].type !== "sap.ui.model.odata.v2.ODataModel") {
                    continue;
                }
                // Default model is registered under the empty string in the manifest, but
                // getModel() expects no argument (or a non-empty string) for the default model.
                var oModel = sModel ? oComponent.getModel(sModel) : oComponent.getModel();
                if (!oModel) {
                    continue;
                }
                oModel.attachEvent("metadataFailed", function (oEvent) {
                    var oParams = oEvent.getParameters();
                    fnShowMetadataError(oParams, oErrorTexts, oDisplayState, oModel);
                });
                oModel.attachEvent("requestFailed", function (oEvent) {
                    var oParams = oEvent.getParameters();

                    // An entity that was not found in the service is also throwing a 404 error in oData.
                    // We already cover this case with a notFound target so we skip it here.
                    // A request that cannot be sent to the server is a technical error that we have to handle though.
                    if (oParams.response.statusCode !== "404" || (oParams.response.statusCode === 404 && oParams.response.responseText.indexOf(
                        "Cannot POST") === 0)) {
                        try {
                            if (JSON.parse(oParams.response.responseText) && JSON.parse(oParams.response.responseText).error) {
                                var oError = { sErrorText: JSON.parse(oParams.response.responseText).error.message.value };
                                if (JSON.parse(oParams.response.responseText).error.innererror.errordetails) {
                                    var aDetails = JSON.parse(oParams.response.responseText).error.innererror.errordetails;
                                    oError.details = "";
                                    aDetails.forEach(function (item) {
                                        if (item.code.indexOf("/IWBEP/") === -1 && item.code.indexOf("/IWFND/") === -1) {
                                            oError.details += item.code + ": " + item.message + "<br/>";
                                        }
                                    });
                                }
                                fnShowServiceError(oParams, oError, oDisplayState);
                            } else {
                                fnShowServiceError(oParams, oErrorTexts, oDisplayState);
                            }
                        } catch (oError) {
                            //Timeout - Return message is an XML and can therefore not be parsed using JSON.parse
                            //TS, 08.06.2022, Try XML Parsing instead
                            try {
                                var oParser = new DOMParser();
                                var oXmlDoc = oParser.parseFromString(oParams.response.responseText, "text/xml");
                                var sErrorMessage = oXmlDoc.getElementsByTagName("message")[0].childNodes[0].nodeValue;
                                oErrorTexts.details = sErrorMessage;
                                fnShowServiceError(oParams, oErrorTexts, oDisplayState);
                            } catch (oError) {
                                fnShowServiceError(oParams, oErrorTexts, oDisplayState);
                            }
                        }
                    }

                    //Reset changes to prevent errors due to batch calls in the future
                    oModel.resetChanges();
                });
            }
        }
    };
});
