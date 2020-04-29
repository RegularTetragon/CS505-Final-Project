export enum PatientStatusCode {
    NoSymptomsUntested = "0",
    NoSymptomsNegative = "1",
    NoSymptomsPositive = "2",
    SymptomsUntested = "3",
    SymptomsNegative = "4",
    SymptomsPositive = "5",
    CriticalPositive = "6"
}

export const ZIP_ALERT_AMOUNT = 15


export const positiveCodes = new Set<PatientStatusCode>(
    [
        PatientStatusCode.CriticalPositive,
        PatientStatusCode.NoSymptomsPositive,
        PatientStatusCode.SymptomsPositive
    ]
)

export interface PatientData {
    first_name : string,
    last_name : string,
    mrn : string,
    zip_code : string,
    patient_status_code : PatientStatusCode
}