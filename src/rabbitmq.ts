import { PatientData, positiveCodes, ZIP_ALERT_AMOUNT } from "./types"
import amqp from "amqplib"
import {Observable, Subject} from "rxjs"

let ampqcredentials : amqp.Options.Connect = {
    hostname: '128.163.202.61',
    username: 'student',
    password: 'student01',
    vhost: 'patient_feed',
}


export async function rabbitmq() : Promise<Subject<PatientData>> {
    const connection = await amqp.connect(ampqcredentials)
    console.log("Connected to RabbitMq")
    const channel = await connection.createChannel()
    let subject = new Subject<PatientData>()
    await channel.assertExchange('patient_data', 'topic', {durable:false})
    await channel.assertQueue("patient_data_q", {durable: false})
    await channel.purgeQueue("patient_data_q")
    await channel.bindQueue('patient_data_q','patient_data', '#')
    await channel.consume('patient_data_q',
        (msg) => {
            const patientData : PatientData[] = JSON.parse(<string><unknown>msg?.content);
            for (const patientDatum of patientData) {
                subject.next(patientDatum)
            }
        }
    )
    subject.toPromise().then(()=>channel.close())
    return subject
    
}