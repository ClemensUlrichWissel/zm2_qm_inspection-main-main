function initModel() {
	var sUrl = "/sap/opu/odata/sap/ZM2_QM_INSPECTION_SRV/";
	var oModel = new sap.ui.model.odata.ODataModel(sUrl, true);
	sap.ui.getCore().setModel(oModel);
}