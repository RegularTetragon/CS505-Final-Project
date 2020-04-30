import express from "express"

import { PatientStatusCode, positiveCodes, PatientData } from "./types"
import { rabbitmq } from "./rabbitmq";
import { OrientDBClient } from "orientjs"

import { create } from "domain";
import { initializeOrient, orientConfig, schemifyOrient, populateOrient, resetOrient, dblogin } from "./orientsetup";


let db_reset_semaphore = 0;

async function pipeRabbitToOrient(orient : OrientDBClient) {
    let db = await orient.session(dblogin)
    let rabbit = await rabbitmq((patientData) => {
        db.update('Patient').set({
            location: db.select().from('Location').where({'zip_code':patientData.zip_code}),
            first_name: patientData.first_name,
            last_name: patientData.last_name,
            mrn: patientData.mrn,
            patient_status_code: patientData.patient_status_code
        }).upsert().where({"mrn": patientData.mrn}).one()
    })
    rabbit.on('close', () => db.close())
    return rabbit
}

async function main() {
    
    const app = express();
    const orient = await OrientDBClient.connect(orientConfig)
    await initializeOrient(orient);
    await schemifyOrient(orient);
    await populateOrient(orient);

    pipeRabbitToOrient(orient)
    

    try {
        //await connect(console.log)
    }
    catch (e) {
        console.log(e)
    }
    //#region       Listeners
    app.post("/siddhi/zip_alert", async(req, res) => {
        console.log(req.body)
        console.log("zip alert received")
        res.status(201).send("hi :3")
    })  

    app.post("/siddhi/state_alert", async(req, res) => {
        console.log(req.body);
        console.log("state alert received")
        res.status(201).send("hi :3")
    })

    app.post("/siddhi/rabbit", async(req, res) => {
        console.log(req.body);
        console.log("rabit received")
        res.status(201).send("hi :3")
    })


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
                    await resetOrient(orient);
                    res.status(200).send(
                        {reset_status_code: '1'}
                    )
                }
                catch (e) {
                    console.error(e);
                    res.status(400).send(
                        {
                            reset_status_code: '0',
                            error: e
                        }
                    );
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
            throw "Not implemented"
        }
    )
    /*
    * API alert on statewide when at least five zipcodes are in alert state (based on RT1) within the same 15 second window
    */
    app.get("/api/alertlist",
        async (req, res) => {
            throw "Not implemented"
        }
    )
    /*
    * API statewide positive and negative test counter
    */
    app.get("/api/testcount",
        async (req, res) => {
            res.send()
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
        throw "Not implemented"
    })
    //#endregion

    app.listen(8088)
    console.log("Listening on port 8088")
    
}

main()

