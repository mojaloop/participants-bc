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

 * Coil
 *  - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import {LogLevel} from "@mojaloop/logging-bc-public-types-lib";
import {
	ParticipantsHttpClient
} from "@mojaloop/participants-bc-client";
import {Participant} from "@mojaloop/participant-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import {MLKafkaProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import * as uuid from "uuid";

/* ********** Constants Begin ********** */

// General.
const BOUNDED_CONTEXT_NAME: string = "participants-bc";
const SERVICE_NAME: string = "integration-tests";
const SERVICE_VERSION: string = "0.0.1";

// Message broker.
const MESSAGE_BROKER_HOST: string = process.env.PARTICIPANTS_MESSAGE_BROKER_HOST ?? "localhost";
const MESSAGE_BROKER_PORT_NO: number =
	parseInt(process.env.PARTICIPANTS_MESSAGE_BROKER_PORT_NO ?? "") || 9092;
const MESSAGE_BROKER_URL: string = `${MESSAGE_BROKER_HOST}:${MESSAGE_BROKER_PORT_NO}`;

// Logging.
const LOGGING_LEVEL: LogLevel = LogLevel.INFO;
const LOGGING_TOPIC: string = `${BOUNDED_CONTEXT_NAME}_${SERVICE_NAME}_logging`;

// Web server.
const WEB_SERVER_HOST: string = process.env.PARTICIPANTS_WEB_SERVER_HOST ?? "localhost";
const WEB_SERVER_PORT_NO: number =
	parseInt(process.env.PARTICIPANTS_WEB_SERVER_PORT_NO ?? "") || 1234;

// Participants HTTP client.
const BASE_URL_PARTICIPANTS_HTTP_SERVICE: string = `http://${WEB_SERVER_HOST}:${WEB_SERVER_PORT_NO}`;
const TIMEOUT_MS_PARTICIPANTS_HTTP_CLIENT: number = 10_000;

/* ********** Constants End ********** */

let logger: KafkaLogger;
let participantsHttpClient: ParticipantsHttpClient;
const VALID_ACCESS_TOKEN: string = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNSMHVoT2hpM05VbmJlMTF5SDZtOUZtcFpNN2JiRVl2czdpbGNfanN1MHMifQ.eyJ0eXAiOiJCZWFyZXIiLCJhenAiOiJzZWN1cml0eS1iYy11aSIsInJvbGVzIjpbXSwiaWF0IjoxNjYxMzM4MDUxLCJleHAiOjE2NjEzNDE2NTEsImF1ZCI6Im1vamFsb29wLnZuZXh0LmRlZmF1bHRfYXVkaWVuY2UiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjMyMDEvIiwic3ViIjoidXNlcjo6dXNlciIsImp0aSI6IjA0NWQwOTc0LWZkMDUtNGZhYS1iNzRkLTIzZGEwNjhhMjNlMSJ9.hYXBLADnY8DeSzyXMKvQyByAy8pjeV_x35f4eedpTR68w2Igessqmb4JNYCftU0K8bvrhIeZKxzUPdWUHDxFYJLJPlK_fvlbk7_3Utou5sPa9ubH-SH87ITNevbeJXA6PnvlgE0eqDFaCs4YQ2EELW3b1uuFoEif2zFIsq32PFcjcMSEj5shNMDTpctyhwP4-1i7SRaxbclOXXRpYw0nIp-QenJ7IJOnCAOAolH4yxoHdf7y7BkXNlbn4XYQv6GOmEABIgqu3ftUI1Gg25YRyVgy-HROT3LlYbnly8mZ6kE595WngrMEp_RXYN9hQnqoWKzd0FXzKlsSVgIqBzpdbQ";

describe("participant - integration tests", () => {
	beforeAll(async () => {
		const kafkaProducerOptions: MLKafkaProducerOptions = {
			kafkaBrokerList: MESSAGE_BROKER_URL
			// TODO: producerClientId?
		}
		logger = new KafkaLogger( // TODO: ILogger? is this the logger to use?
			BOUNDED_CONTEXT_NAME,
			SERVICE_NAME,
			SERVICE_VERSION,
			kafkaProducerOptions,
			LOGGING_TOPIC,
			LOGGING_LEVEL
		);
		await logger.start(); // TODO: here or on the aggregate?
		participantsHttpClient = new ParticipantsHttpClient(
			logger,
			BASE_URL_PARTICIPANTS_HTTP_SERVICE,
			VALID_ACCESS_TOKEN,
			TIMEOUT_MS_PARTICIPANTS_HTTP_CLIENT
		);
	});

	afterAll(async () => {
		await logger.destroy();
	});

	// Create participant:
	test("create non-existent participant", async () => {
		const participantId: string = uuid.v4();
		const participant: Participant = {
			id: participantId,
			name: "Peter Pan",
			isActive: false,
			description: "",
			createdDate: 0,
			createdBy: "",
			lastUpdated: 0,
			participantEndpoints: [],
			participantAccounts: []
		};
		const participantReceived: Participant = await participantsHttpClient.createParticipant(participant);
		expect(participantReceived.id).toEqual(participantId);
	});

	// Get participant by id:
	test("get non-existent participant by id", async () => {
		const id: string = uuid.v4();
		const participant: Participant | null = await participantsHttpClient.getParticipantById(id);
		expect(participant).toBeNull();
	});
});
