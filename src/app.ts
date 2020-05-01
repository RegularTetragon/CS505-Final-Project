import express from "express"

import { PatientStatusCode, positiveCodes, PatientData } from "./types"
import { rabbitmq } from "./rabbitmq";
import amqp from "amqplib"
import { OrientDBClient, ORecord } from "orientjs"

import { create } from "domain";
import { initializeOrient, orientConfig, schemifyOrient, populateOrient, resetOrient, dblogin } from "./orientsetup";
import { Subject, Observable, timer, interval } from "rxjs";
import { windowCount, windowTime, count, scan, multicast, sample } from "rxjs/operators"
import { watchFile } from "fs";


let db_reset_semaphore = 0;

interface PNCounter {
    positive_test : number;
    negative_test : number;
}

async function pipeRabbitToOrient(orient : OrientDBClient) {
    let rabbit = await rabbitmq()
    let stop = false;
    
    let actions = []
    rabbit.pipe(windowCount(128)).subscribe(async (patientData) => {
        let db = await orient.session(dblogin)
        patientData.subscribe(async (patientDatum)=> {
                let patientRecord = await db.update('Patient').set({
                    first_name: patientDatum.first_name,
                    last_name: patientDatum.last_name,
                    mrn: patientDatum.mrn,
                    patient_status_code: patientDatum.patient_status_code
                }).upsert().where({"mrn": patientDatum.mrn}).one<ORecord>();
                if (isPositive(patientDatum)) {
                    zipcounts.set(String(patientDatum.zip_code), (zipcounts.get(String(patientDatum.zip_code))??0) + 1)
                }
                if (patientDatum.patient_status_code == "5" || patientDatum.patient_status_code == "6") {
                    //Report to a hospital
                    //Patient stays at home
                    /*await db.create('EDGE', 'LocatedAt').from(
                        `
                        SELECT FROM (TRAVERSE out('LocatedAt') FROM(
                        TRAVERSE in('LocatedAt') FROM (SELECT FROM Patient WHERE mrn="${patientDatum.mrn}"))) WHERE @class="Hospital")
                        `
                    ).to(
                        db.select().from('Patient').where({'mrn':patientDatum.mrn})
                    ).one()*/
                }
                else {
                    //Patient stays at home
                    await db.create('EDGE', 'LocatedAt').from(
                        db.select().from('Location').where({'zip_code':patientDatum.zip_code})
                    ).to(
                        db.select().from('Patient').where({'mrn':patientDatum.mrn})
                    ).one();
                }
            })
        db.close();
    })

    return rabbit
}

function isPositive(patient : PatientData) {
    return positiveCodes.has(patient.patient_status_code);
}

async function getPatientAssignemntFromMrn(mrn : string, orient : OrientDBClient) {
    let db = await orient.session(dblogin);
    db.select("location").from("Patient").where({"mrn" : mrn})
}


let zipcounts = new Map<string, number>()

interval(15000).subscribe(
    ()=> {
        console.log("Clearing")
        zipcounts.clear()
    }
)

async function main() {
    
    const app = express();
    const orient = await OrientDBClient.connect(orientConfig)

    
    //If you want to reset even the static parts of OrientDb, uncomment this.
    //await initializeOrient(orient);
    //await schemifyOrient(orient);
    //await populateOrient(orient);
    
    let rabbitSubject : Subject<PatientData>;
    await resetOrient(orient);

    let runningCounter : PNCounter;
    

    //#endregion
    //#region       Management
    /*
    * API for name of team and list of student ids that are part of the team
    */
    app.get("/api/getteam",
        async (req, res) => {
            res.status(200).send({
                team_name: 'Vince',
                Team_members_sid:['10991225'],
                app_status_code:'1'
            })
        }
    )
    /*
    * This API is used for resetting all data. This function initializes your application. 
    * This can be accomplished by dropping and recreating the databases and/or reinitializing any other services,
    * variables, or processes you might be using to manage data.
    */

    app.get("/api/reset",
        async (req, res) => {
            //TODO: Reset
            if (db_reset_semaphore == 0) {
                db_reset_semaphore++;
                try {
                    if (rabbitSubject != undefined) {
                        rabbitSubject.complete()
                    }
                    await resetOrient(orient);
                    rabbitSubject = await pipeRabbitToOrient(orient);
                    runningCounter = {
                        positive_test: 0,
                        negative_test: 0
                    }
                    rabbitSubject.subscribe(
                        (current) => {
                            runningCounter = {
                                positive_test: runningCounter.positive_test + (isPositive(current) ? 1 : 0),
                                negative_test: runningCounter.negative_test + (isPositive(current) ? 0 : 1)
                            }
                        }
                    )
                    

                    res.status(200).send(
                        {reset_status_code: '1'}
                    )
                }
                catch (e) {
                    res.status(400).send(
                        {
                            reset_status_code: '0',
                            error: e
                        }
                    );
                    console.error(e);
                }
                finally {
                    db_reset_semaphore--;
                }
            }
            else {
                res.status(400).send({reset_status_code:'0', message: 'reset is already in progress.'})
            }
        }
    )
    //#endregion
    //#region       Real-Time Reporting
    /*
    * API alert on zipcode that is in alert state based on growth of postive cases.
    */
    app.get("/api/zipalertlist",
        async (req, res) => {
            console.log(zipcounts)
            res.send(
                {"ziplist": Array.from(zipcounts.entries()).filter(([zip_code,quantity])=>quantity > 15).map(([zip_code, _])=>zip_code)}
            )
        }
    )
    /*
    * API alert on statewide when at least five zipcodes are in alert state (based on RT1) within the same 15 second window
    */
    app.get("/api/alertlist",
        async (req, res) => {
            res.send({
                state_status:
                    (Array.from(zipcounts.entries())
                    .filter(([_,quantity])=>quantity > 15)
                    .map(([zip_code, _])=>zip_code).length > 5) ? "1" 
                                                                : "0"
            })
        }
    )
    /*
    * API statewide positive and negative test counter
    */
    app.get("/api/testcount",
        async (req, res) => {
            res.send(runningCounter)
        }
    )
    //#endregion
    //#region       Logical and Operational
    //OF 1
    app.get("/api/route", async (req, res)=>{
        throw "Not implemented"
    })

    //OF 2


    //OF 3
    app.get("/api/gethospital/:id", async (req,res)=>{
        let db = await orient.session()
        let hospitalP = db.select().from("Hospital").where({"id" : req.params.id}).one<ORecord>();
        let locationP = db.command<ORecord>(`
            TRAVERSE in('LocatedAt')
            FROM (SELECT Hospital WHERE id = ${req.params.id})
        `).one();
        let [hospital, location] = await Promise.all([hospitalP, locationP])
        res.send(
            {
                zipcode: (<any>location).zip_code,
                total_beds: (<any>hospital).beds,
                available_beds: (<any>hospital).beds,
            }
        )
    })
    //#endregion

    app.listen(8088)
    console.log("Listening on port 8088")
    
}

main()