import express from "express"

import { PatientStatusCode, positiveCodes, PatientData } from "./types"
import { connect } from "./subjects";
import orientdb, { OServer, ORecord, OStatement, OrientDBClient, ODatabaseSession, ODatabaseTransaction, ODatabaseSessionOptions, DropDatabaseOptions, OClassProperty, OClass } from "orientjs"
import csv from "csv"
import fs from "fs"
import { pipeline } from "stream";
import { create } from "domain";
    

const orientConfig : orientdb.ServerConfig = {
    host : "localhost",
    port: 2424
}

const dblogin : ODatabaseSessionOptions = {
    name: 'cs505-final',
    username: 'root',
    password: 'rootpwd'
}

function FileToOrientSync<T>(db : ODatabaseSession, filename : string, callback : (transaction : ODatabaseSession, current : T)=>any) : Promise<any> {
    return new Promise((res,rej) => {
        db.begin();
        const csvParser = new csv.parse.Parser({
            delimiter: ",",
            from_line: 2
        })
        fs.createReadStream(filename).pipe(csvParser)
        csvParser.on("error", (err)=>rej(err))
        csvParser.on("end", ()=>res(db.commit(undefined)))
        csvParser.on("close", ()=>res(db.commit(undefined)))
        csvParser.on("data", (data) => {
            console.log(data)
            callback(db, data)
        })
    })
}

function FileToOrientAsync<T>(db : ODatabaseSession, filename : string, callback : (transaction : ODatabaseSession, current : T)=>any) : Promise<any[]> {
    return new Promise((res,rej) => {
        const csvParser = new csv.parse.Parser({
            delimiter: ",",
            from_line: 2
        })
        let actions : Promise<any>[] = []
        fs.createReadStream(filename).pipe(csvParser)
        csvParser.on("error", (err)=>rej(err))
        csvParser.on("end", ()=>res(Promise.all(actions)))
        csvParser.on("close", ()=>res(Promise.all(actions)))
        csvParser.on("data", (data) => {
            actions.push(callback(db, data))
        })
    })
}


async function resetOrient(orient : OrientDBClient) {
    console.log("Resetting orientDb")

    console.log("Dropping database")
    await orient.dropDatabase(<DropDatabaseOptions>dblogin)
    console.log("Creating database")
    await orient.createDatabase(dblogin)
    const db = await orient.session(dblogin)
    console.log("Creating hospital")
    await db.class.create("Hospital", "V").then((hospital) => {
            hospital.property.create(
                [
                    {
                        name: 'beds',
                        type: 'Integer'
                    }
                ]
            )
            return hospital
        })

    
    console.log("Creating location");
    let location = await db.class.create("Location", "V")
    await location.property.create(
        [
            {
                name: 'zip_code',
                type: 'Integer',
                mandatory: true,

            }
        ]
    )
    console.log("Populating OrientDB zipcodes...")
    await FileToOrientAsync<string[]>(db, "./kyzipdetails.csv",
        (t, [zip,zip_name,city,state,county])=>
            t.create('VERTEX', 'Location').set({zip_code:zip}).one()
    )
    console.log("Creating zipcodes index...")
    await db.index.create({
        type: "UNIQUE",
        name: "Zipcode",
        class: "Location",
        properties: ["zip_code"]
    })
    
    
    console.log("Creating distance");
    await db.class.create("Distance", "E").then((distance) => {
            distance.property.create(
                [
                    {
                        name : 'in',
                        type: 'Link',
                        linkedClass: 'Location'
                    },
                    {
                        name : 'out',
                        type: 'Link',
                        linkedClass: 'Location'
                    }
                ]
            )
            distance.property.create(
                {
                    name : 'distance',
                    type: 'Double'
                }
            )
            return distance
        });

    
    console.log("Populating OrientDB distances...")
    await FileToOrientAsync<string[]>(db, "./kyzipdistance.csv",
        (t, [zipcode_from, zipcode_to, distance]) =>
            t.create('EDGE', 'Distance')
                .from(t.select().from('Location').where({'zip_code':zipcode_from}))
                .to(t.select().from('Location').where({'zip_code':zipcode_to}))
                .set({distance: distance})
                .one()
        )
    /*
    console.log("Populating OrientDB hospital locations...")
    const populateHospital = CommitFileToOrient<string[]>(db, "./hospitals.csv",
        (transaction, [ID,NAME,ADDRESS,CITY,STATE,ZIP,TYPE,BEDS,COUNTY,COUNTYFIPS,COUNTRY,LATITUDE,LONGITUDE,NAICS_CODE,WEBSITE,OWNER,TRAUMA,HELIPAD]) =>
        );
    
    console.log("Populating OrientDB hospitals")
    */
    console.log("OrientDB reset sucessful.");
}

let db_reset_semaphore = 0;

async function main() {
    
    const app = express();
    const orient = await orientdb.OrientDBClient.connect(orientConfig)
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
                    throw "Not implemented"
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

