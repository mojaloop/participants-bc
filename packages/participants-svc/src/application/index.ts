/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Coil
 - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

//TODO re-enable configs
//import appConfigs from "./config";

import express, {Express} from "express";
import {ExpressRoutes} from "./routes";
import {ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";
import {AuthorizationClient, TokenHelper} from "@mojaloop/security-bc-client-lib";
import {
    AuditClient,
    KafkaAuditClientDispatcher,
    LocalAuditClientCryptoProvider
} from "@mojaloop/auditing-bc-client-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import {existsSync} from "fs";
import {
    IParticipantsRepository,
    IParticipantsEndpointRepository,
    IParticipantsApprovalRepository,
    IParticipantsAccountRepository
} from "../domain/repo_interfaces";
import {IAccountsBalancesAdapter} from "../domain/iparticipant_account_balances_adapter";
import {MongoDBParticipantsEndpointRepo } from "../infrastructure/mongodb_participants_endpoint_repo";
import {MongoDBParticipantsRepo} from "../infrastructure/mongodb_participants_repo";
import {MongoDBParticipantsApprovalRepo} from "../infrastructure/mongodb_participants_approval_repo";
import {MongoDBParticipantsAccountRepo} from "../infrastructure/mongodb_participants_account_repo";
import {RestAccountsAndBalances} from "../infrastructure/rest_acc_bal";
import {ParticipantAggregate} from "../domain/participant_agg";
import {addPrivileges} from "./config/privileges";
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import { Server } from "net";

const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;

const BC_NAME = "participants-bc";
const APP_NAME = "participants-svc";
const APP_VERSION = "0.0.3";
const LOGLEVEL = LogLevel.DEBUG;

const SVC_DEFAULT_HTTP_PORT = 3010;

const AUTH_Z_TOKEN_ISSUER_NAME = process.env["AUTH_Z_TOKEN_ISSUER_NAME"] || "http://localhost:3201/"
const AUTH_Z_TOKEN_AUDIENCE = process.env["AUTH_Z_TOKEN_AUDIENCE"] || "mojaloop.vnext.default_audience"
const AUTH_Z_SVC_JWKS_URL = process.env["AUTH_Z_SVC_JWKS_URL"] || "http://localhost:3201/.well-known/jwks.json";

const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3202";

const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const MONGO_URL = process.env["MONGO_URL"] || "mongodb://root:example@localhost:27017/";
const ACCOUNTS_BALANCES_URL = process.env["ACCOUNTS_BALANCES_URL"] || "http://localhost:3020/";

const KAFKA_AUDITS_TOPIC = process.env["KAFKA_AUDITS_TOPIC"] || "audits";
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const AUDIT_CERT_FILE_PATH = process.env["AUDIT_CERT_FILE_PATH"] || "./tmp_key_file";


let app:Express;
let expressServer: Server;
let routes: ExpressRoutes;
let auditClient:AuditClient;
let participantAgg: ParticipantAggregate
let authorizationClient: AuthorizationClient;
let tokenHelper:TokenHelper;

let repoPart: IParticipantsRepository;
let repoPartEndpoint: IParticipantsEndpointRepository;
let repoPartApproval: IParticipantsApprovalRepository;
let repoPartAccount: IParticipantsAccountRepository;
let restAccAndBal: IAccountsBalancesAdapter;

// kafka logger
const kafkaProducerOptions = {
    kafkaBrokerList: KAFKA_URL
}

const logger:KafkaLogger = new KafkaLogger(
        BC_NAME,
        APP_NAME,
        APP_VERSION,
        kafkaProducerOptions,
        KAFKA_LOGS_TOPIC,
        LOGLEVEL
);

function setupExpress() {
    app = express();
    app.use(express.json()); // for parsing application/json
    app.use(express.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded
}

function setupRoutes() {
    routes = new ExpressRoutes(participantAgg, tokenHelper, logger);

    app.use("/", routes.MainRouter);

    app.use((req, res) => {
        // catch all
        res.send(404);
    });
}

async function start():Promise<void>{
    /// start logger
    await logger.start();

    /// start auditClient
    if(!existsSync(AUDIT_CERT_FILE_PATH)) {
        if(PRODUCTION_MODE) process.exit(9);
        // create e tmp file
        LocalAuditClientCryptoProvider.createRsaPrivateKeyFileSync(AUDIT_CERT_FILE_PATH, 2048);
    }
    const cryptoProvider = new LocalAuditClientCryptoProvider(AUDIT_CERT_FILE_PATH);
    const auditDispatcher = new KafkaAuditClientDispatcher(kafkaProducerOptions, KAFKA_AUDITS_TOPIC, logger);
    // NOTE: to pass the same kafka logger to the audit client, make sure the logger is started/initialised already
    auditClient = new AuditClient(BC_NAME, APP_NAME, APP_VERSION, cryptoProvider, auditDispatcher);
    await auditClient.init();

    // setup privileges - bootstrap app privs and get priv/role associations
    authorizationClient = new AuthorizationClient(BC_NAME, APP_NAME, APP_VERSION, AUTH_N_SVC_BASEURL, logger);
    addPrivileges(authorizationClient);
    await authorizationClient.bootstrap(true);
    await authorizationClient.fetch();

    // repos and aggregate
    repoPart = new MongoDBParticipantsRepo(MONGO_URL, logger);
    repoPartEndpoint = new MongoDBParticipantsEndpointRepo(MONGO_URL, logger);
    repoPartApproval = new MongoDBParticipantsApprovalRepo(MONGO_URL, logger);
    repoPartAccount = new MongoDBParticipantsAccountRepo(MONGO_URL, logger);
    restAccAndBal = new RestAccountsAndBalances(ACCOUNTS_BALANCES_URL, logger);

    participantAgg = new ParticipantAggregate(
            repoPart,
            repoPartEndpoint,
            repoPartApproval,
            repoPartAccount,
            restAccAndBal,
            auditClient,
            authorizationClient,
            logger
    );

    await participantAgg.init();

    // token helper
    tokenHelper = new TokenHelper(AUTH_Z_TOKEN_ISSUER_NAME, AUTH_Z_SVC_JWKS_URL,AUTH_Z_TOKEN_AUDIENCE, logger);
    await tokenHelper.init();

    setupExpress();
    setupRoutes();

    let portNum = SVC_DEFAULT_HTTP_PORT;
    if(process.env["SVC_HTTP_PORT"] && !isNaN(parseInt(process.env["SVC_HTTP_PORT"]))) {
        portNum = parseInt(process.env["SVC_HTTP_PORT"])
    }

    expressServer = app.listen(portNum, () => {
        console.log(`🚀 Server ready at: http://localhost:${portNum}`);
        logger.info("Participants service started");
    });

}

export async function stop(){
    await repoPart.destroy();
    await repoPartEndpoint.destroy();
    await repoPartApproval.destroy();
    await repoPartAccount.destroy();
    await restAccAndBal.destroy();
    await auditClient.destroy();
    await repoPart.destroy();
    expressServer.close();
    await logger.destroy();
}


async function _handle_int_and_term_signals(signal: NodeJS.Signals): Promise<void> {
    logger.info(`Service - ${signal} received - cleaning up...`);
    await stop();
    process.exit();
}

//catches ctrl+c event
process.on("SIGINT", _handle_int_and_term_signals.bind(this));

//catches program termination event
process.on("SIGTERM", _handle_int_and_term_signals.bind(this));

//do something when app is closing
process.on('exit', () => {
    logger.info("Example server - exiting...");
});


start().catch((err:unknown) => {
    logger.fatal(err);
});
