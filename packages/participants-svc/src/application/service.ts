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
import { IParticipantsRepository} from "../domain/repo_interfaces";
import {IAccountsBalancesAdapter} from "../domain/iparticipant_account_balances_adapter";
import {MongoDBParticipantsRepo} from "../infrastructure/mongodb_participants_repo";

import {ParticipantAggregate} from "../domain/participant_agg";
import {AppPrivilegesDefinition} from "./config/privileges";
import {Server} from "net";
import {GrpcAccountsAndBalancesAdapter} from "../infrastructure/grpc_acc_bal_adapter";

import configClient from "./config";
import {IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib";
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";

const BC_NAME = configClient.boundedContextName;
const APP_NAME = configClient.applicationName;
const APP_VERSION = configClient.applicationVersion;
const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOG_LEVEL: LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

const SVC_DEFAULT_HTTP_PORT = 3010;

const AUTH_Z_TOKEN_ISSUER_NAME = process.env["AUTH_Z_TOKEN_ISSUER_NAME"] || "http://localhost:3201/"
const AUTH_Z_TOKEN_AUDIENCE = process.env["AUTH_Z_TOKEN_AUDIENCE"] || "mojaloop.vnext.default_audience"
const AUTH_Z_SVC_JWKS_URL = process.env["AUTH_Z_SVC_JWKS_URL"] || "http://localhost:3201/.well-known/jwks.json";

const AUTH_Z_SVC_BASEURL = process.env["AUTH_Z_SVC_BASEURL"] || "http://localhost:3202";

const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const MONGO_URL = process.env["MONGO_URL"] || "mongodb://root:example@localhost:27017/";
const ACCOUNTS_BALANCES_URL = process.env["ACCOUNTS_BALANCES_URL"] || "localhost:5678";

const KAFKA_AUDITS_TOPIC = process.env["KAFKA_AUDITS_TOPIC"] || "audits";
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const AUDIT_KEY_FILE_PATH = process.env["AUDIT_KEY_FILE_PATH"] || "/app/data/audit_private_key.pem";


const kafkaProducerOptions = {
    kafkaBrokerList: KAFKA_URL
};

let globalLogger: ILogger;

export class Service {
    static logger: ILogger;
    static app: Express;
    static expressServer: Server;
    static auditClient: IAuditClient;
    static authorizationClient: IAuthorizationClient;
    static tokenHelper: TokenHelper;
    static participantAgg:ParticipantAggregate;
    static repoPart: IParticipantsRepository;
    static accountsBalancesAdapter: IAccountsBalancesAdapter;

    static async start(
            logger?: ILogger,
            auditClient?: IAuditClient,
            authorizationClient?: IAuthorizationClient,
            repoPart?: IParticipantsRepository,
            accAndBalAdapter?: IAccountsBalancesAdapter
    ): Promise<void> {
        /// start config client - this is not mockable (can use STANDALONE MODE if desired)
        await configClient.init();
        await configClient.bootstrap(true);
        await configClient.fetch();

        if (!logger) {
            logger = new KafkaLogger(
                    BC_NAME,
                    APP_NAME,
                    APP_VERSION,
                    kafkaProducerOptions,
                    KAFKA_LOGS_TOPIC,
                    LOG_LEVEL
            );
            await (logger as KafkaLogger).init();
        }
        globalLogger = this.logger = logger;

        /// start auditClient
        if (!auditClient) {
            if (!existsSync(AUDIT_KEY_FILE_PATH)) {
                if (PRODUCTION_MODE) process.exit(9);
                // create e tmp file
                LocalAuditClientCryptoProvider.createRsaPrivateKeyFileSync(AUDIT_KEY_FILE_PATH, 2048);
            }
            const cryptoProvider = new LocalAuditClientCryptoProvider(AUDIT_KEY_FILE_PATH);
            const auditDispatcher = new KafkaAuditClientDispatcher(kafkaProducerOptions, KAFKA_AUDITS_TOPIC, logger);
            // NOTE: to pass the same kafka logger to the audit client, make sure the logger is started/initialised already
            auditClient = new AuditClient(BC_NAME, APP_NAME, APP_VERSION, cryptoProvider, auditDispatcher);
            await auditClient.init();
        }
        this.auditClient = auditClient;


        // authorization client
        if (!authorizationClient) {
            // setup privileges - bootstrap app privs and get priv/role associations
            authorizationClient = new AuthorizationClient(BC_NAME, APP_NAME, APP_VERSION, AUTH_Z_SVC_BASEURL, logger.createChild("AuthorizationClient"));
            try {
                authorizationClient.addPrivilegesArray(AppPrivilegesDefinition);
                await (authorizationClient as AuthorizationClient).bootstrap(true);
                await (authorizationClient as AuthorizationClient).fetch();
            }catch(err){
                console.error(err);
                this.logger.error(err);
            }
        }
        this.authorizationClient = authorizationClient;


        // repos and aggregate
        if(!repoPart){
            repoPart = new MongoDBParticipantsRepo(MONGO_URL, logger);
        }
        this.repoPart = repoPart;

        // Accounts and Balances Client
        if(!accAndBalAdapter){
            accAndBalAdapter = new GrpcAccountsAndBalancesAdapter(ACCOUNTS_BALANCES_URL, logger);
        }
        this.accountsBalancesAdapter = accAndBalAdapter;


        // create the aggregate
        this.participantAgg = new ParticipantAggregate(
                repoPart,
                accAndBalAdapter,
                auditClient,
                authorizationClient,
                logger
        );

        await this.participantAgg.init();

        // token helper
        this.tokenHelper = new TokenHelper(AUTH_Z_TOKEN_ISSUER_NAME, AUTH_Z_SVC_JWKS_URL, AUTH_Z_TOKEN_AUDIENCE, logger);
        await this.tokenHelper.init();

        this.setupExpress();
    }

    static setupExpress():void {
        this.app = express();
        this.app.use(express.json()); // for parsing application/json
        this.app.use(express.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

        const routes = new ExpressRoutes(this.participantAgg, this.tokenHelper, this.logger);

        this.app.use("/", routes.MainRouter);

        this.app.use((req, res) => {
            // catch all
            res.send(404);
        });

        let portNum = SVC_DEFAULT_HTTP_PORT;
        if (process.env["SVC_HTTP_PORT"] && !isNaN(parseInt(process.env["SVC_HTTP_PORT"]))) {
            portNum = parseInt(process.env["SVC_HTTP_PORT"])
        }

        this.expressServer = this.app.listen(portNum, () => {
            this.logger.info(`🚀 Server ready at: http://localhost:${portNum}`);
            this.logger.info("Participants service started");
        });
    }

    static async stop() {
        if(this.auditClient) await this.auditClient.destroy();
        if(this.accountsBalancesAdapter) await this.accountsBalancesAdapter.destroy();
        if(this.repoPart) await this.repoPart.destroy();
        if(this.accountsBalancesAdapter) await this.accountsBalancesAdapter.destroy();

        if(this.expressServer) this.expressServer.close();
        if(this.logger && this.logger instanceof KafkaLogger) await this.logger.destroy();
    }
}


/**
 * process termination and cleanup
 */

async function _handle_int_and_term_signals(signal: NodeJS.Signals): Promise<void> {
    console.info(`Service - ${signal} received - cleaning up...`);
    await Service.stop();
    process.exit();
}

//catches ctrl+c event
process.on("SIGINT", _handle_int_and_term_signals);
//catches program termination event
process.on("SIGTERM", _handle_int_and_term_signals);

//do something when app is closing
process.on("exit", async () => {
    globalLogger.info("Microservice - exiting...");
});
process.on("uncaughtException", (err: Error) => {
    globalLogger.error(err);
});