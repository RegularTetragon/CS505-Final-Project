"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var orientjs_1 = __importDefault(require("orientjs"));
var csv_1 = __importDefault(require("csv"));
var fs_1 = __importDefault(require("fs"));
var orientConfig = {
    host: "localhost",
    port: 2424
};
var dblogin = {
    name: 'cs505-final',
    username: 'root',
    password: 'rootpwd'
};
function FileToOrientSync(db, filename, callback) {
    return new Promise(function (res, rej) {
        db.begin();
        var csvParser = new csv_1.default.parse.Parser({
            delimiter: ",",
            from_line: 2
        });
        fs_1.default.createReadStream(filename).pipe(csvParser);
        csvParser.on("error", function (err) { return rej(err); });
        csvParser.on("end", function () { return res(db.commit(undefined)); });
        csvParser.on("close", function () { return res(db.commit(undefined)); });
        csvParser.on("data", function (data) {
            console.log(data);
            callback(db, data);
        });
    });
}
function FileToOrientAsync(db, filename, callback) {
    return new Promise(function (res, rej) {
        var statement = { subtype: "ODatabaseSession", value: db };
        var csvParser = new csv_1.default.parse.Parser({
            delimiter: ",",
            from_line: 2
        });
        fs_1.default.createReadStream(filename).pipe(csvParser);
        csvParser.on("error", function (err) { return rej(err); });
        csvParser.on("end", function () { return statement.subtype == "OStatement" ? res(statement.value.all()) : res([]); });
        csvParser.on("close", function () { return statement.subtype == "OStatement" ? res(statement.value.all()) : res([]); });
        csvParser.on("data", function (data) {
            statement = { subtype: "OStatement", value: callback(statement, data) };
        });
    });
}
function resetOrient(orient) {
    return __awaiter(this, void 0, void 0, function () {
        var db, location, zipToLocationIndex, locationRecords;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Resetting orientDb");
                    console.log("Dropping database");
                    return [4 /*yield*/, orient.dropDatabase(dblogin)];
                case 1:
                    _a.sent();
                    console.log("Creating database");
                    return [4 /*yield*/, orient.createDatabase(dblogin)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, orient.session(dblogin)];
                case 3:
                    db = _a.sent();
                    console.log("Creating hospital");
                    return [4 /*yield*/, db.class.create("Hospital", "V").then(function (hospital) {
                            hospital.property.create([
                                {
                                    name: 'beds',
                                    type: 'Integer'
                                }
                            ]);
                            return hospital;
                        })];
                case 4:
                    _a.sent();
                    console.log("Creating location");
                    return [4 /*yield*/, db.class.create("Location", "V")];
                case 5:
                    location = _a.sent();
                    return [4 /*yield*/, location.property.create([
                            {
                                name: 'zip_code',
                                type: 'Integer',
                                mandatory: true,
                            }
                        ])];
                case 6:
                    _a.sent();
                    console.log("Populating OrientDB zipcodes...");
                    zipToLocationIndex = new Map();
                    return [4 /*yield*/, FileToOrientAsync(db, "./kyzipdetails.csv", function (t, _a) {
                            var zip = _a[0], zip_name = _a[1], city = _a[2], state = _a[3], county = _a[4];
                            return t.value.create('VERTEX', 'Location').set({ zip_code: zip });
                        })
                        /*for (let locationRecord of locationRecords) {
                            let rid = locationRecord["@rid"]
                            console.log(locationRecord)
                            //zipToLocationIndex.set(zip, "#"+rid!.cluster + ":" + rid!.position)
                        }*/
                    ];
                case 7:
                    locationRecords = _a.sent();
                    /*for (let locationRecord of locationRecords) {
                        let rid = locationRecord["@rid"]
                        console.log(locationRecord)
                        //zipToLocationIndex.set(zip, "#"+rid!.cluster + ":" + rid!.position)
                    }*/
                    console.log(locationRecords);
                    console.log(zipToLocationIndex);
                    console.log("Creating zipcodes index...");
                    return [4 /*yield*/, db.index.create({
                            type: "UNIQUE",
                            name: "Zipcode",
                            class: "Location",
                            properties: ["zip_code"]
                        })];
                case 8:
                    _a.sent();
                    console.log("Creating distance");
                    return [4 /*yield*/, db.class.create("Distance", "E").then(function (distance) {
                            distance.property.create([
                                {
                                    name: 'in',
                                    type: 'Link',
                                    linkedClass: 'Location'
                                },
                                {
                                    name: 'out',
                                    type: 'Link',
                                    linkedClass: 'Location'
                                }
                            ]);
                            distance.property.create({
                                name: 'distance',
                                type: 'Double'
                            });
                            return distance;
                        })];
                case 9:
                    _a.sent();
                    console.log("Populating OrientDB distances...");
                    return [4 /*yield*/, FileToOrientAsync(db, "./kyzipdistance.csv", function (t, _a) {
                            var zipcode_from = _a[0], zipcode_to = _a[1], distance = _a[2];
                            return t.value.create('EDGE', 'Distance')
                                .from(zipToLocationIndex.get(zipcode_from))
                                .to(zipToLocationIndex.get(zipcode_to))
                                .set({ distance: distance });
                        })
                        /*
                        console.log("Populating OrientDB hospital locations...")
                        const populateHospital = CommitFileToOrient<string[]>(db, "./hospitals.csv",
                            (transaction, [ID,NAME,ADDRESS,CITY,STATE,ZIP,TYPE,BEDS,COUNTY,COUNTYFIPS,COUNTRY,LATITUDE,LONGITUDE,NAICS_CODE,WEBSITE,OWNER,TRAUMA,HELIPAD]) =>
                            );
                        
                        console.log("Populating OrientDB hospitals")
                        */
                    ];
                case 10:
                    _a.sent();
                    /*
                    console.log("Populating OrientDB hospital locations...")
                    const populateHospital = CommitFileToOrient<string[]>(db, "./hospitals.csv",
                        (transaction, [ID,NAME,ADDRESS,CITY,STATE,ZIP,TYPE,BEDS,COUNTY,COUNTYFIPS,COUNTRY,LATITUDE,LONGITUDE,NAICS_CODE,WEBSITE,OWNER,TRAUMA,HELIPAD]) =>
                        );
                    
                    console.log("Populating OrientDB hospitals")
                    */
                    console.log("OrientDB reset sucessful.");
                    return [2 /*return*/];
            }
        });
    });
}
var db_reset_semaphore = 0;
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var app, orient;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    app = express_1.default();
                    return [4 /*yield*/, orientjs_1.default.OrientDBClient.connect(orientConfig)];
                case 1:
                    orient = _a.sent();
                    try {
                        //await connect(console.log)
                    }
                    catch (e) {
                        console.log(e);
                    }
                    //#region       Listeners
                    app.post("/siddhi/zip_alert", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            console.log(req.body);
                            console.log("zip alert received");
                            res.status(201).send("hi :3");
                            return [2 /*return*/];
                        });
                    }); });
                    app.post("/siddhi/state_alert", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            console.log(req.body);
                            console.log("state alert received");
                            res.status(201).send("hi :3");
                            return [2 /*return*/];
                        });
                    }); });
                    app.post("/siddhi/rabbit", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            console.log(req.body);
                            console.log("rabit received");
                            res.status(201).send("hi :3");
                            return [2 /*return*/];
                        });
                    }); });
                    //#endregion
                    //#region       Management
                    /*
                    * API for name of team and list of student ids that are part of the team
                    */
                    app.get("/api/getteam", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            res.status(200).send({
                                team_name: 'Vince',
                                Team_members_sid: ['10991225'],
                                app_status_code: '1'
                            });
                            return [2 /*return*/];
                        });
                    }); });
                    /*
                    * This API is used for resetting all data. This function initializes your application.
                    * This can be accomplished by dropping and recreating the databases and/or reinitializing any other services,
                    * variables, or processes you might be using to manage data.
                    */
                    app.get("/api/reset", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var e_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!(db_reset_semaphore == 0)) return [3 /*break*/, 6];
                                    db_reset_semaphore++;
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, 4, 5]);
                                    return [4 /*yield*/, resetOrient(orient)];
                                case 2:
                                    _a.sent();
                                    res.status(200).send({ reset_status_code: '1' });
                                    throw "Not implemented";
                                case 3:
                                    e_1 = _a.sent();
                                    res.status(400).send({
                                        reset_status_code: '0',
                                        error: e_1
                                    });
                                    console.error(e_1);
                                    return [3 /*break*/, 5];
                                case 4:
                                    db_reset_semaphore--;
                                    return [7 /*endfinally*/];
                                case 5: return [3 /*break*/, 7];
                                case 6:
                                    res.status(400).send({ reset_status_code: '0', message: 'reset is already in progress.' });
                                    _a.label = 7;
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); });
                    //#endregion
                    //#region       Real-Time Reporting
                    /*
                    * API alert on zipcode that is in alert state based on growth of postive cases.
                    */
                    app.get("/api/zipalertlist", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            throw "Not implemented";
                        });
                    }); });
                    /*
                    * API alert on statewide when at least five zipcodes are in alert state (based on RT1) within the same 15 second window
                    */
                    app.get("/api/alertlist", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            throw "Not implemented";
                        });
                    }); });
                    /*
                    * API statewide positive and negative test counter
                    */
                    app.get("/api/testcount", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            res.send();
                            return [2 /*return*/];
                        });
                    }); });
                    //#endregion
                    //#region       Logical and Operational
                    //OF 1
                    app.get("/api/route", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            throw "Not implemented";
                        });
                    }); });
                    //OF 2
                    //OF 3
                    app.get("/api/gethospital/:id", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            throw "Not implemented";
                        });
                    }); });
                    //#endregion
                    app.listen(8088);
                    console.log("Listening on port 8088");
                    return [2 /*return*/];
            }
        });
    });
}
main();
//# sourceMappingURL=app.js.map