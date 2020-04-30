import orientdb, { OServer, ORecord, OStatement, OrientDBClient, ODatabaseSession, ODatabaseTransaction, ODatabaseSessionOptions, DropDatabaseOptions, OClassProperty, OClass } from "orientjs"

import csv from "csv"
import fs from "fs"
import { pipeline } from "stream";


export function FileToOrientAsync<T>(db : ODatabaseSession, filename : string, callback : (transaction : ODatabaseSession, current : T)=>any) : Promise<any[]> {
    return new Promise((res,rej) => {
        const csvParser = new csv.parse.Parser({
            delimiter: ",",
            from_line: 2
        })
        let actions : Promise<any>[] = []
        let file = fs.createReadStream(filename).pipe(csvParser)
        csvParser.on("error", (err)=>rej(err))
        csvParser.on("end", ()=>res(Promise.all(actions)))
        csvParser.on("close", ()=>res(Promise.all(actions)))
        let pauses = 1;
        csvParser.on("data", async (data) => {
            if (actions.length > 512 * pauses) {
                pauses++;
                file.pause();
                console.log("Overflow. Waiting for queued actions to complete...")
                await Promise.all(actions)
                console.log("Resume...")
                file.resume();
            }
            actions.push(callback(db, data))
        })
        
    })
}

export function FileToOrientAsync_<T>(db : ODatabaseSession, filename : string, callback : (transaction : ODatabaseSession, current : T)=>any) : Promise<null> {
    return new Promise((res,rej) => {
        const csvParser = new csv.parse.Parser({
            delimiter: ",",
            from_line: 2
        })
        let actions : Promise<any>[] = []
        let file = fs.createReadStream(filename).pipe(csvParser)
        csvParser.on("error", (err)=>rej(err))
        csvParser.on("end", ()=>res())
        csvParser.on("close", ()=>res())
        let pauses = 1;
        csvParser.on("data", async (data) => {
            if (actions.length > 512 * pauses) {
                pauses++;
                file.pause();
                console.log("Overflow. Waiting for queued actions to complete...")
                await Promise.all(actions)
                actions = []
                console.log("Resume...")
                file.resume();
            }
            actions.push(callback(db, data))
        })
        
    })
}


export const orientConfig : orientdb.ServerConfig = {
    host : "localhost",
    port: 2424
}

export const dblogin : ODatabaseSessionOptions = {
    name: 'cs505-final',
    username: 'root',
    password: '10991225'
}

async function createPatient(db : ODatabaseSession) {
    let patient = await db.class.create("Patient", "V");
    await patient.property.create(
        [
            {name: "first_name", type: "String"},
            {name: "last_name", type: "String"},
            {name: "mrn", type: "String"},
            {name: "patient_status_code", type: "Integer", min: 0, max: 6},
            {name: "location", type: "Link", linkedClass: "Location"}
        ]
    )
    return patient
}

export async function resetOrient(orient : OrientDBClient) {
    const db = await orient.session(dblogin)
    console.log("Creating patient")
    await db.class.drop("Patient", {ifexist: true});
    return await createPatient(db)
}

export async function initializeOrient(orient : OrientDBClient) {
    console.log("Initializing orientDb")

    console.log("Dropping database")
    await orient.dropDatabase(<DropDatabaseOptions>dblogin)
    console.log("Creating database")
    await orient.createDatabase(dblogin)

    
}

export async function schemifyOrient(orient : OrientDBClient) {
    const db = await orient.session(dblogin)

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
    
    console.log("Creating location index")
    await db.index.create({
        type: "UNIQUE",
        name: "Zipcode",
        class: "Location",
        properties: ["zip_code"]
    })

    console.log("Creating hospital")
    let hospital = await db.class.create("Hospital", "V")
    await hospital.property.create(
        [
            {
                name: 'beds',
                type: 'Integer'
            },
            {
                name: 'id',
                type: 'String'
            },
            {
                name: 'name',
                type: 'String'
            }
        ]
    )
    await hospital.property.create(
        [
            {
                name: 'location',
                type: 'Link',
                linkedClass: 'Location'
            }
        ]
    )

    console.log("Creating distance");
    let distance = await db.class.create("Distance", "E")
    await distance.property.create(
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
    await distance.property.create(
        {
            name : 'distance',
            type: 'Double'
        }
    )

    await createPatient(db);

    
    console.log("OrientDB schema established.");
    db.close();
}

export async function populateOrient(orient : OrientDBClient) {
    let db = await orient.session(dblogin);
    
    console.log("Populating OrientDB locations...")
    
    let locationRecords : ORecord[] = await FileToOrientAsync<string[]>(db, "./kyzipdetails.csv",
        (t, [zip,zip_name,city,state,county])=>
            t.create('VERTEX', 'Location').set({zip_code:zip}).one()
    )
    let zipcodeMap = new Map<string,string>();
    for (let record of locationRecords) {
        const rid = record["@rid"]
        const zip_code = (<any>record)["zip_code"]
        zipcodeMap.set(String(zip_code), "#" + rid!.cluster + ":" + rid!.position)
    }

    console.log("Populating OrientDB hospital locations...")
    await FileToOrientAsync_<string[]>(db, "./hospitals.csv",
        (transaction, [ID,NAME,ADDRESS,CITY,STATE,ZIP,TYPE,BEDS,COUNTY,COUNTYFIPS,COUNTRY,LATITUDE,LONGITUDE,NAICS_CODE,WEBSITE,OWNER,TRAUMA,HELIPAD]) =>
            transaction.create('VERTEX', 'Hospital').set({
                beds: BEDS,
                id: ID,
                name: NAME,
                location: zipcodeMap.get(ZIP)
            }).one()
    );

    console.log("Populating OrientDB distances...")
    //This takes forever so just return.
    await FileToOrientAsync_<string[]>(db, "./kyzipdistance.csv",
        (t, [zipcode_from, zipcode_to, distance]) => t.create('EDGE', 'Distance')
            .from(zipcodeMap.get(zipcode_from))
            .to(zipcodeMap.get(zipcode_to))
            .set({distance: distance}).exec()
            
        )
    db.close()
}  