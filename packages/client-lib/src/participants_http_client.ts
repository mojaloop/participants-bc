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
 - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import axios, {AxiosInstance, AxiosResponse, AxiosError} from "axios";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
	Participant,
	ParticipantAccount,
	ParticipantApproval,
	ParticipantEndpoint
} from "@mojaloop/participant-bc-public-types-lib";
import {
	ConnectionRefusedError,
	UnableToApproveParticipantError,
	UnableToCreateParticipantAccountError,
	UnableToCreateParticipantEndpointError,
	UnableToCreateParticipantError, UnableToDeleteParticipantAccountError,
	UnableToDeleteParticipantEndpointError,
	UnableToDisableParticipantError,
	UnableToEnableParticipantError,
	UnableToGetParticipantAccountError,
	UnableToGetParticipantEndpointsError,
	UnableToGetParticipantError,
	UnableToGetParticipantsError, UnauthorizedError
} from "./errors";

export class ParticipantsHttpClient {
	// Properties received through the constructor.
	private readonly logger: ILogger;
	// Other properties.
	private readonly httpClient: AxiosInstance;
	private readonly UNKNOWN_ERROR_MESSAGE: string = "Unknown error";
	private accessToken: string;

	constructor(
		logger: ILogger,
		baseUrlHttpService: string,
		accessToken: string,
		timeoutMs: number
	) {
		this.logger = logger;
		this.accessToken = accessToken;

		this.httpClient = axios.create({
			baseURL: baseUrlHttpService,
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${accessToken}`
			},
			timeout: timeoutMs
		});

		// Set the AUTH token for any request
		this.httpClient.interceptors.request.use((config)=>{
			config.headers!.Authorization =  this.accessToken ? `Bearer ${this.accessToken}` : '';
			return config;
		});
	}
	
	setAccessToken(accessToken: string): void {
		this.accessToken = accessToken;
	}

	private _checkUnauthorizedResponse(axiosError: AxiosError){
		if(axiosError.response && axiosError.response.status === 403)
			throw new UnauthorizedError();
	}

	private _handleServerError<T extends Error>(err: unknown, errorType: new(msg:string) => T):void{
		const axiosError: AxiosError = err as AxiosError;

		this._checkUnauthorizedResponse(axiosError);

		// handle connection refused
		if(axiosError.code === "ECONNREFUSED"){
			const err = new ConnectionRefusedError();
			this.logger.error(err);
			throw err;
		}

		// handle errors with an data.msg prop in the body
		if (axiosError.response !== undefined) {
			const errMsg =  (axiosError.response.data as any).msg || "unknown error";
			const err = new errorType(errMsg);
			this.logger.error(err);
			throw err;
		}

		// handle everything else
		throw new errorType(this.UNKNOWN_ERROR_MESSAGE);
	}

	async getAllParticipants(): Promise<Participant[] | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.get(
				'/participants',
				{
					validateStatus: (statusCode: number) => {
						return statusCode === 200 || statusCode === 404; // Resolve only 200s and 404s.
					}
				}
			);
			if (axiosResponse.status === 404) return null;
			return axiosResponse.data;
		} catch (e: unknown) {
			this._handleServerError(e, UnableToGetParticipantsError);
			return null;
		}
	}

	async getParticipantsByIds(ids : string[]): Promise<Participant[] | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.get(
				`/participants/${ids.toString()}/multi`,
				{
					validateStatus: (statusCode: number) => {
						return statusCode === 200 || statusCode === 404; // Resolve only 200s and 404s.
					}
				}
			);
			if (axiosResponse.status === 404) return null;
			return axiosResponse.data;
		} catch (e: unknown) {
			this._handleServerError(e, UnableToGetParticipantsError);
			return null;
		}
	}

	async getParticipantById(participantId: string): Promise<Participant | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.get(
				`/participants/${participantId}`,
				{
					validateStatus: (statusCode: number) => {
						return statusCode === 200 || statusCode === 404; // Resolve only 200s and 404s.
					}
				}
			);
			if (axiosResponse.status === 404) return null;
			return axiosResponse.data;
		} catch (e: unknown) {
			this._handleServerError(e, UnableToGetParticipantError);
			return null;
		}
	}

	async createParticipant(participant: Participant): Promise<Participant | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.post("/participants", participant);
			return axiosResponse.data;
		} catch (e: unknown) {
			this._handleServerError(e, UnableToCreateParticipantError);
			return null;
		}
	}

	async approveParticipant(partApproval: ParticipantApproval): Promise<void> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.put(
				`/participants/${partApproval.participantId}/approve`, partApproval);
			if (axiosResponse.status !== 200) throw new UnableToApproveParticipantError(
				`Participant ${partApproval.participantId} not approved [${axiosResponse.status}].`
			);
		} catch (e: unknown) {
			this._handleServerError(e, UnableToApproveParticipantError);
		}
	}

	async disableParticipant(participantId: string): Promise<void> {
		try {
			const partApproval : ParticipantApproval = {
				participantId,
				lastUpdated: 0,
				maker: "",
				makerLastUpdated: 0,
				checker: "",
				checkerLastUpdated: 0,
				checkerApproved: false,
				feedback: ""
			}
			const axiosResponse: AxiosResponse = await this.httpClient.put(
				`/participants/${partApproval.participantId}/disable`, partApproval);
			if (axiosResponse.status !== 200) throw new UnableToDisableParticipantError(
				`Participant ${partApproval.participantId} not disabled [${axiosResponse.status}].`
			);
		} catch (e: unknown) {
			this._handleServerError(e, UnableToDisableParticipantError);
		}
	}

	async enableParticipant(participantId: string): Promise<void> {
		try {
			const partApproval : ParticipantApproval = {
				participantId,
				lastUpdated: 0,
				maker: "",
				makerLastUpdated: 0,
				checker: "",
				checkerLastUpdated: 0,
				checkerApproved: false,
				feedback: ""
			}
			const axiosResponse: AxiosResponse = await this.httpClient.put(
				`/participants/${partApproval.participantId}/enable`, partApproval);
			if (axiosResponse.status !== 200) throw new UnableToEnableParticipantError(
				`Participant ${partApproval.participantId} not enabled [${axiosResponse.status}].`
			);
		} catch (e: unknown) {
			this._handleServerError(e, UnableToEnableParticipantError);
		}
	}

	async getParticipantEndpointsById(participantId: string): Promise<ParticipantEndpoint[] | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.get(
				`/participants/${participantId}/endpoints`,
				{
					validateStatus: (statusCode: number) => {
						return statusCode === 200 || statusCode === 404; // Resolve only 200s and 404s.
					}
				}
			);
			if (axiosResponse.status === 404) return null;
			return axiosResponse.data;
		} catch (e: unknown) {
			this._handleServerError(e, UnableToGetParticipantEndpointsError);
			throw new UnableToGetParticipantEndpointsError((e as any)?.message);
		}
	}

	async createParticipantEndpoint(
		participant: Participant,
		partEndpoint: ParticipantEndpoint
	): Promise<void> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.post(
				`/participants/${participant.id}/endpoint`, partEndpoint);
			if (axiosResponse.status !== 200) throw new UnableToCreateParticipantEndpointError(
				`Create Participant Endpoint for ${participant.id} failed [${axiosResponse.status}].`
			);
			return axiosResponse.data;
		} catch (e: unknown) {
			this._handleServerError(e, UnableToCreateParticipantEndpointError);
		}
	}

	async deleteParticipantEndpoint(
		participant: Participant,
		partEndpoint: ParticipantEndpoint
	): Promise<void> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.delete(
				`/participants/${participant.id}/endpoint`,
				{ data : { source: partEndpoint } });
			if (axiosResponse.status !== 200) throw new UnableToDeleteParticipantEndpointError(
				`Delete Participant Endpoint for ${participant.id} failed [${axiosResponse.status}].`
			);
			return axiosResponse.data;
		} catch (e: unknown) {
			this._handleServerError(e, UnableToDeleteParticipantEndpointError);
		}
	}

	async getParticipantAccountsById(participantId: string): Promise<ParticipantAccount[] | null> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.get(
				`/participants/${participantId}/accounts`,
				{
					validateStatus: (statusCode: number) => {
						return statusCode === 200 || statusCode === 404; // Resolve only 200s and 404s.
					}
				}
			);
			if (axiosResponse.status === 404) return null;
			return axiosResponse.data;
		} catch (e: unknown) {
			this._handleServerError(e, UnableToGetParticipantAccountError);
			return null;
		}
	}

	async createParticipantAccount(
		participant: Participant,
		partAccount: ParticipantAccount
	): Promise<void> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.post(
				`/participants/${participant.id}/account`, partAccount);
			if (axiosResponse.status !== 200) throw new UnableToCreateParticipantAccountError(
				`Create Participant Account for ${participant.id} failed [${axiosResponse.status}].`
			);
			return axiosResponse.data;
		} catch (e: unknown) {
			this._handleServerError(e, UnableToCreateParticipantAccountError);
		}
	}

	async deleteParticipantAccount(
		participant: Participant,
		partAccount: ParticipantAccount
	): Promise<void> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.delete(
				`/participants/${participant.id}/account`,
				{ data : { source: partAccount } });
			if (axiosResponse.status !== 200) throw new UnableToDeleteParticipantAccountError(
				`Delete Participant Account for ${participant.id} failed [${axiosResponse.status}].`
			);
			return axiosResponse.data;
		} catch (e: unknown) {
			this._handleServerError(e, UnableToDeleteParticipantAccountError);
			throw new UnableToDeleteParticipantAccountError((e as any)?.message);
		}
	}
}
