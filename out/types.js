"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var PatientStatusCode;
(function (PatientStatusCode) {
    PatientStatusCode["NoSymptomsUntested"] = "0";
    PatientStatusCode["NoSymptomsNegative"] = "1";
    PatientStatusCode["NoSymptomsPositive"] = "2";
    PatientStatusCode["SymptomsUntested"] = "3";
    PatientStatusCode["SymptomsNegative"] = "4";
    PatientStatusCode["SymptomsPositive"] = "5";
    PatientStatusCode["CriticalPositive"] = "6";
})(PatientStatusCode = exports.PatientStatusCode || (exports.PatientStatusCode = {}));
exports.ZIP_ALERT_AMOUNT = 15;
exports.positiveCodes = new Set([
    PatientStatusCode.CriticalPositive,
    PatientStatusCode.NoSymptomsPositive,
    PatientStatusCode.SymptomsPositive
]);
//# sourceMappingURL=types.js.map